#!/bin/bash

# ByteNite Service Components Deployment Script
# This script pushes all components to the ByteNite platform

set -e

echo "🚀 Deploying ByteNite Service Components..."

# Function to push a component
push_component() {
    local component_dir=$1
    local component_type=$2
    
    echo "📦 Pushing $component_dir..."
    cd "$component_dir"
    
    if [ "$component_type" = "app" ]; then
        bytenite app push .
    else
        bytenite engine push .
    fi
    
    cd ..
    echo "✅ $component_dir pushed successfully"
}

# Check if we're in the right directory
if [ ! -f "deploy.sh" ]; then
    echo "❌ Please run this script from the bytenite_service directory"
    exit 1
fi

# Push transcription service (app)
push_component "transcription-service" "app"

# Push decision extractor assembler (engine)
push_component "decision-extractor-assembler" "engine"

# Push directory partitioner (engine)
push_component "directory-partitioner" "engine"

echo ""
echo "🎉 All components deployed successfully!"
echo ""
echo "You can now use these components in your ByteNite jobs:"
echo "  - transcription-service (app)"
echo "  - decision-extractor-assembler (assembler engine)"
echo "  - directory-partitioner (partitioner engine)"
echo ""
echo "To list your deployed components:"
echo "  bytenite app list"
echo "  bytenite engine list" 