-- Migration number: 0005

CREATE TABLE rate_limits (
	key TEXT PRIMARY KEY,
	count INTEGER NOT NULL,
	reset_at INTEGER NOT NULL
);

CREATE INDEX rate_limits_reset_at ON rate_limits (reset_at);
