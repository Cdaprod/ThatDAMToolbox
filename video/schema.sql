-- /video/schema.sql
-- Database schema for media indexer
-- This file shows you exactly what tables are created

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Main files table - stores metadata about all indexed media files
CREATE TABLE IF NOT EXISTS files (
    id            TEXT PRIMARY KEY,        -- SHA1 hash of file content
    path          TEXT UNIQUE NOT NULL,    -- Full path to file
    size_bytes    INTEGER NOT NULL,        -- File size in bytes
    mtime         TEXT NOT NULL,           -- Last modified time (ISO-8601)
    mime          TEXT,                    -- MIME type (video/mp4, image/jpeg, etc.)
    width_px      INTEGER,                 -- Image/video width (NULL if unknown)
    height_px     INTEGER,                 -- Image/video height (NULL if unknown)
    duration_s    REAL,                    -- Video duration in seconds (NULL for images/unknown)
    batch         TEXT,                    -- Album/folder name (for grouping)
    sha1          TEXT,                    -- SHA1 hash (compatibility with existing scripts)
    created_at    TEXT NOT NULL            -- When this record was created (ISO-8601)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime);
CREATE INDEX IF NOT EXISTS idx_files_batch ON files(batch);  
CREATE INDEX IF NOT EXISTS idx_files_sha1 ON files(sha1);

-- Sync tracking table (compatible with your existing photo sync script)
CREATE TABLE IF NOT EXISTS copies (
    sha1 TEXT PRIMARY KEY,                 -- SHA1 hash of copied file
    dest TEXT,                             -- Destination path where file was copied
    ts   REAL                              -- Timestamp when copy was made
);

-- Example queries you can run:

-- Get recent files
-- SELECT * FROM files ORDER BY created_at DESC LIMIT 10;

-- Get files by album/batch
-- SELECT * FROM files WHERE batch = 'YourAlbumName' ORDER BY mtime DESC;

-- Get statistics
-- SELECT 
--   COUNT(*) as total_files,
--   SUM(size_bytes) as total_bytes,
--   COUNT(DISTINCT batch) as total_batches
-- FROM files;

-- Get files by type  
-- SELECT mime, COUNT(*) as count FROM files GROUP BY mime ORDER BY count DESC;