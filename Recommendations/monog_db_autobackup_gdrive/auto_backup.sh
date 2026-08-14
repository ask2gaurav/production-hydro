# Docker MongoDB Google Drive Backup Script

#!/bin/bash
# ============================================================
# Docker MongoDB to Google Drive Weekly Backup Script
# ============================================================
# Description: Dumps a Dockerized MongoDB with authentication, compresses the
#              output, uploads it to Google Drive via rclone, and performs
#              retention cleanup both locally and on cloud storage.
# ============================================================

# ------------------------------------------------------------------------------
# 1. Load Environment Variables from .env File
# ------------------------------------------------------------------------------
ENV_FILE="/home/vhosts/react/hydro-colon-therapy/env/.env_auto_dbbackup"

if [ -f "$ENV_FILE" ]; then
    # Source the environment file to load configurations dynamically
    source "$ENV_FILE"
else
    echo "CRITICAL ERROR: Environment configuration file not found at ${ENV_FILE}. Aborting." >&2
    exit 1
fi

# Fallback/Default Configuration Variables if not fully specified in .env
CONTAINER_NAME="${CONTAINER_NAME:-hydro-colon-therapy-mongodb-1}"
AUTH_DB="${AUTH_DB:-admin}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-/home/vhosts/react/hydro-colon-therapy}"
GDRIVE_REMOTE="${GDRIVE_REMOTE:-gdrive}"
GDRIVE_FOLDER="${GDRIVE_FOLDER:-MongoBackups}"
RETENTION_DAYS=${RETENTION_DAYS:-10}

# Ensure critical variables loaded from .env are not empty
if [ -z "$MONGO_USER" ] || [ -z "$MONGO_PASS" ] || [ -z "$GDRIVE_CLIENT_ID" ] || [ -z "$GDRIVE_CLIENT_SECRET" ]; then
    echo "CRITICAL ERROR: Missing required credentials (MONGO_USER, MONGO_PASS, GDRIVE_CLIENT_ID, or GDRIVE_CLIENT_SECRET) in ${ENV_FILE}." >&2
    exit 1
fi

# ------------------------------------------------------------------------------
# 2. Setup Internal States & Logging
# ------------------------------------------------------------------------------
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="mongobkp_${MONGO_DB}_${TIMESTAMP}.archive.gz"
LOCAL_FILE_PATH="${LOCAL_BACKUP_DIR}/${BACKUP_NAME}"
# Ensure log output directories exist
mkdir -p "$LOCAL_BACKUP_DIR"

echo "=== Backup Process Started: $(date) ==="
# ------------------------------------------------------------------------------
# 3. Step 1: Execute Database Dump from Container
# ------------------------------------------------------------------------------
echo "Extracting database archive from Docker container: ${CONTAINER_NAME}..."
# Executing mongodump inside the container and piping the compressed stream directly
# to a local compressed archive file on the host architecture.
if docker exec -i "${CONTAINER_NAME}" mongodump \
    --username "${MONGO_USER}" \
    --password "${MONGO_PASS}" \
    --authenticationDatabase "${AUTH_DB}" \
    --db "${MONGO_DB}" \
    --archive \
    --gzip > "${LOCAL_FILE_PATH}"; then
    
    echo "Success: Local database archive created safely at ${LOCAL_FILE_PATH}"else
    echo "CRITICAL ERROR: Failed to execute mongodump inside container. Aborting upload." >&2

    exit 1fi
# ------------------------------------------------------------------------------
# 4. Step 2: Upload to Google Drive via Rclone
# ------------------------------------------------------------------------------
echo "Syncing backup file to Google Drive tracking path: ${GDRIVE_REMOTE}:${GDRIVE_FOLDER}..."
# Explicitly passing the custom client credentials dynamically to ensure 
# authentication stability over the retired shared infrastructure.
if rclone copy "${LOCAL_FILE_PATH}" "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}" \
    --drive-client-id "${GDRIVE_CLIENT_ID}" \
    --drive-client-secret "${GDRIVE_CLIENT_SECRET}"; then
    echo "Success: Secure cloud synchronization completed successfully."else
    echo "ERROR: Cloud upload failed. Keeping local file intact for manual recovery." >&2
    exit 1fi

# ------------------------------------------------------------------------------
# 5. Step 3: Local Retention Enforcement
# ------------------------------------------------------------------------------
echo "Evaluating storage landscape to purge historical archives older than ${RETENTION_DAYS} days..."
# Locate and remove local database dumps older than the retention threshold
find "${LOCAL_BACKUP_DIR}" -type f -name "mongobkp_${MONGO_DB}_*.archive.gz" -mtime +"${RETENTION_DAYS}" -exec rm -v {} \;

# ------------------------------------------------------------------------------
# 6. Step 4: Cloud Retention Enforcement
# ------------------------------------------------------------------------------
echo "Evaluating remote cloud landscape to purge old archives from Google Drive..."

# Fetch all existing backup files along with their modification time, delimited by '|'
FILE_LIST=$(rclone lsf --format "t|p" "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}" \
    --drive-client-id "${GDRIVE_CLIENT_ID}" \
    --drive-client-secret "${GDRIVE_CLIENT_SECRET}" 2>/dev/null | grep "mongobkp_${MONGO_DB}_" | sort)

# Count how many total backup files currently exist in the cloud directory
FILE_COUNT=$(echo "$FILE_LIST" | grep -c "mongobkp_${MONGO_DB}_")

echo "Current cloud backup count: ${FILE_COUNT} (Target Threshold: ${RETENTION_DAYS})"

# Safety Check: Only proceed with removing files if the total file count strictly exceeds 
# the retention threshold, ensuring you always keep a rolling baseline of backups.
if [ "$FILE_COUNT" -gt "$RETENTION_DAYS" ]; then
    # Extract the absolute oldest file line (the first line in our chronologically sorted list)
    NUM_FILE_TO_DELETE=$((FILE_COUNT - RETENTION_DAYS))
    echo "Cloud file count exceeds ${RETENTION_DAYS}. Preparing to remove ${NUM_FILE_TO_DELETE} oldest file(s)."
    #loop through the number of files to delete and remove them one by one
    for i in $(seq 1 $NUM_FILE_TO_DELETE); do
        OLDEST_LINE=$(echo "$FILE_LIST" | head -n 1)
        # Isolate the exact filename from the delimiter split
        OLDEST_FILE=$(echo "$OLDEST_LINE" | cut -d'|' -f2-)
        
        if [ -n "$OLDEST_FILE" ]; then
            echo "Cloud file count exceeds ${RETENTION_DAYS}. Removing ONLY the oldest file: ${OLDEST_FILE}"
            if rclone deletefile "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/${OLDEST_FILE}" \
                --drive-client-id "${GDRIVE_CLIENT_ID}" \
                --drive-client-secret "${GDRIVE_CLIENT_SECRET}"; then
                echo "Success: Oldest cloud file deleted safely."
            else
                echo "ERROR: Failed to delete oldest cloud file." >&2
            fi
        fi
    
else
    echo "Cloud backup count (${FILE_COUNT}) is within safety threshold (<= ${RETENTION_DAYS}). No cloud files will be removed."
fi
echo "=== Backup Process Completed Successfully: $(date) ==="