PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE
    CHECK (length(slug) BETWEEN 3 AND 60 AND slug = lower(slug)),
  timezone TEXT NOT NULL DEFAULT 'America/Lima'
    CHECK (length(trim(timezone)) BETWEEN 3 AND 64),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  email TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(email)) BETWEEN 3 AND 254),
  password_hash TEXT NOT NULL CHECK (length(password_hash) >= 20),
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  email TEXT COLLATE NOCASE CHECK (email IS NULL OR length(trim(email)) BETWEEN 3 AND 254),
  phone TEXT CHECK (phone IS NULL OR length(trim(phone)) BETWEEN 6 AND 30),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  email TEXT COLLATE NOCASE CHECK (email IS NULL OR length(trim(email)) BETWEEN 3 AND 254),
  phone TEXT CHECK (phone IS NULL OR length(trim(phone)) BETWEEN 6 AND 30),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 5 AND 480),
  price_cents INTEGER NOT NULL CHECK (price_cents BETWEEN 0 AND 100000000),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS employee_services (
  tenant_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, employee_id, service_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, service_id) REFERENCES services(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS employee_schedules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TEXT NOT NULL CHECK (
    length(start_time) = 5 AND
    start_time GLOB '[0-2][0-9]:[0-5][0-9]' AND
    start_time BETWEEN '00:00' AND '23:59'
  ),
  end_time TEXT NOT NULL CHECK (
    length(end_time) = 5 AND
    end_time GLOB '[0-2][0-9]:[0-5][0-9]' AND
    end_time BETWEEN '00:00' AND '23:59'
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (start_time < end_time),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_id, day_of_week, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (start_at < end_at),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, client_id) REFERENCES clients(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, service_id) REFERENCES services(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_active
  ON users (tenant_id, active, name);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_active_name
  ON clients (tenant_id, active, name);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_active_name
  ON employees (tenant_id, active, name);
CREATE INDEX IF NOT EXISTS idx_services_tenant_active_name
  ON services (tenant_id, active, name);
CREATE INDEX IF NOT EXISTS idx_employee_services_service
  ON employee_services (tenant_id, service_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_schedules_employee_day
  ON employee_schedules (tenant_id, employee_id, day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_employee_time
  ON appointments (tenant_id, employee_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_appointments_client_time
  ON appointments (tenant_id, client_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_service_time
  ON appointments (tenant_id, service_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status_time
  ON appointments (tenant_id, status, start_at);
