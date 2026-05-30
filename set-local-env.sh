#!/bin/bash

# Quick script to set local Supabase env vars
# Run this before running tests: source set-local-env.sh

SUPABASE_STATUS=$(supabase status 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "Supabase not running. Start it with 'supabase start'"
    return 1
fi

# Extract keys from status output
LOCAL_URL="http://localhost:54321"
LOCAL_ANON_KEY=$(echo "$SUPABASE_STATUS" | grep "anon key:" | head -1 | sed 's/.*anon key: //' | tr -d '\n' | tr -d ' ')
LOCAL_SERVICE_KEY=$(echo "$SUPABASE_STATUS" | grep "service_role key:" | head -1 | sed 's/.*service_role key: //' | tr -d '\n' | tr -d ' ')

if [ -z "$LOCAL_ANON_KEY" ] || [ -z "$LOCAL_SERVICE_KEY" ]; then
    echo "Could not extract keys from 'supabase status'. Run it manually to check."
    return 1
fi

export SUPABASE_URL="$LOCAL_URL"
export SUPABASE_ANON_KEY="$LOCAL_ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$LOCAL_SERVICE_KEY"
export EXPO_PUBLIC_SUPABASE_URL="$LOCAL_URL"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="$LOCAL_ANON_KEY"

echo "Local Supabase environment variables set:"
echo "SUPABASE_URL=$SUPABASE_URL"
echo "SUPABASE_ANON_KEY=${LOCAL_ANON_KEY:0:20}..."
echo "SUPABASE_SERVICE_ROLE_KEY=${LOCAL_SERVICE_KEY:0:20}..."