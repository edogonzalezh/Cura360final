-- =============================================================
-- CURA360 — SQL Schema + RLS Policies
-- =============================================================
-- Run this entire file in Supabase Studio → SQL Editor.
-- It creates tables, enables RLS, and defines all security policies.
-- =============================================================

-- -------------------------------------------------------------
-- 1. PROFILES
--    Extended user info linked to auth.users.
--    Created automatically when a user signs up (see trigger below).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id    uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role  text NOT NULL DEFAULT 'patient'
            CHECK (role IN ('professional', 'patient')),

  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- -------------------------------------------------------------
-- 2. PATIENTS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  age              smallint    NOT NULL CHECK (age >= 0 AND age <= 150),
  diagnosis        text,
  comorbidities    text,
  professional_id  uuid        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT patients_pkey           PRIMARY KEY (id),
  CONSTRAINT patients_prof_fkey      FOREIGN KEY (professional_id)
    REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_patients_professional ON patients(professional_id);

-- -------------------------------------------------------------
-- 3. WOUNDS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wounds (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid        NOT NULL,
  type       text        NOT NULL,
  location   text        NOT NULL,
  dimensions text,
  status     text        NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'pending', 'critical', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT wounds_pkey        PRIMARY KEY (id),
  CONSTRAINT wounds_patient_fkey FOREIGN KEY (patient_id)
    REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wounds_patient ON wounds(patient_id);

-- -------------------------------------------------------------
-- 4. TREATMENTS (curaciones)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS treatments (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  wound_id   uuid        NOT NULL,
  technique  text        NOT NULL,
  supplies   text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT treatments_pkey       PRIMARY KEY (id),
  CONSTRAINT treatments_wound_fkey FOREIGN KEY (wound_id)
    REFERENCES wounds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_treatments_wound ON treatments(wound_id);


-- =============================================================
-- TRIGGER: Auto-create profile on user sign-up
-- =============================================================
-- This function runs after every INSERT into auth.users.
-- It creates a matching row in `profiles` with the default role.
-- The frontend (or an admin) can then UPDATE the role as needed.
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'patient');
  RETURN NEW;
END;
$$;

-- Drop existing trigger if present, then re-create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================
-- Enable RLS on every table.
-- Professionals see only their own patients' data.
-- Patients see only their own record.
-- =============================================================

-- ── profiles ─────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read their own profile
CREATE POLICY profiles_select_own
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Only the owner can update their own profile
CREATE POLICY profiles_update_own
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ── patients ─────────────────────────────────────────────
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Professional: read patients they own
CREATE POLICY patients_select_by_professional
  ON patients FOR SELECT
  USING (professional_id = auth.uid());

-- Patient: read only their own row (id matches auth uid)
CREATE POLICY patients_select_own
  ON patients FOR SELECT
  USING (id = auth.uid());

-- Professional: insert patients (professional_id must be self)
CREATE POLICY patients_insert_by_professional
  ON patients FOR INSERT
  WITH CHECK (professional_id = auth.uid());

-- Professional: update own patients
CREATE POLICY patients_update_by_professional
  ON patients FOR UPDATE
  USING (professional_id = auth.uid());

-- ── wounds ───────────────────────────────────────────────
ALTER TABLE wounds ENABLE ROW LEVEL SECURITY;

-- Professional: read wounds for patients they own
CREATE POLICY wounds_select_by_professional
  ON wounds FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE professional_id = auth.uid()
    )
  );

-- Patient: read wounds that belong to them
CREATE POLICY wounds_select_own
  ON wounds FOR SELECT
  USING (patient_id = auth.uid());

-- Professional: insert wounds for own patients
CREATE POLICY wounds_insert_by_professional
  ON wounds FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE professional_id = auth.uid()
    )
  );

-- Professional: update wounds for own patients
CREATE POLICY wounds_update_by_professional
  ON wounds FOR UPDATE
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE professional_id = auth.uid()
    )
  );

-- ── treatments ───────────────────────────────────────────
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;

-- Professional: read treatments for wounds they manage
CREATE POLICY treatments_select_by_professional
  ON treatments FOR SELECT
  USING (
    wound_id IN (
      SELECT w.id FROM wounds w
      JOIN patients p ON w.patient_id = p.id
      WHERE p.professional_id = auth.uid()
    )
  );

-- Patient: read treatments on their own wounds
CREATE POLICY treatments_select_own
  ON treatments FOR SELECT
  USING (
    wound_id IN (
      SELECT id FROM wounds WHERE patient_id = auth.uid()
    )
  );

-- Professional: insert treatments
CREATE POLICY treatments_insert_by_professional
  ON treatments FOR INSERT
  WITH CHECK (
    wound_id IN (
      SELECT w.id FROM wounds w
      JOIN patients p ON w.patient_id = p.id
      WHERE p.professional_id = auth.uid()
    )
  );
