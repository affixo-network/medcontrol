-- T-046 isolated schema; apply only to a separately provisioned replica database.
-- No production migration or medical-vault table modification.
CREATE TABLE IF NOT EXISTS t046_replica_objects (
 vault_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('segment','manifest')),
 commitment text NOT NULL CHECK(commitment ~ '^[a-f0-9]{64}$'),
 payload jsonb NOT NULL,
 PRIMARY KEY(vault_id,kind,commitment)
);
CREATE TABLE IF NOT EXISTS t046_replica_heads (
 vault_id text PRIMARY KEY,
 generation bigint NOT NULL CHECK(generation>0),
 commitment text NOT NULL CHECK(commitment ~ '^[a-f0-9]{64}$')
);
