CREATE TABLE IF NOT EXISTS t046_replica_capacity (
 vault_id text PRIMARY KEY,
 limit_bytes bigint NOT NULL CHECK(limit_bytes>=0),
 reserved_bytes bigint NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
 CHECK(reserved_bytes<=limit_bytes)
);
CREATE TABLE IF NOT EXISTS t046_replica_reservations (
 vault_id text NOT NULL REFERENCES t046_replica_capacity(vault_id),
 request_id text NOT NULL,
 bytes bigint NOT NULL CHECK(bytes>0),
 PRIMARY KEY(vault_id,request_id)
);
