#!/bin/bash
set -e
WWW_DIR="www"

echo "=== Verifying www directory ==="

if [ ! -f "$WWW_DIR/index.html" ]; then
    echo "ERROR: www/index.html not found"
    exit 1
fi

echo "index.html found: $(wc -c < "$WWW_DIR/index.html") bytes"
echo "All files in www/:"
ls -la "$WWW_DIR/"
