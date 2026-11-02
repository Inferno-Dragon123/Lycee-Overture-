CREATE TABLE IF NOT EXISTS toolbox_catalog_cards(code text PRIMARY KEY,data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS toolbox_catalog_meta(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),version text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS toolbox_catalog_sources(name text PRIMARY KEY,raw text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
