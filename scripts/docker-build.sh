#!/bin/bash

# =============================================================================
# Docker Build Script for Biodiversidade-Online
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
TARGET="production"
PUSH=false
REGISTRY="ghcr.io"
IMAGE_NAME="biopinda/biodiversidade-online"
TAG="latest"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Build Docker images for Biodiversidade-Online"
    echo ""
    echo "OPTIONS:"
    echo "  -t, --target TARGET     Build target (development|production) [default: production]"
    echo "  -p, --push             Push image to registry after build"
    echo "  -r, --registry REGISTRY Container registry [default: ghcr.io]"
    echo "  -n, --name NAME        Image name [default: biopinda/biodiversidade-online]"
    echo "  -T, --tag TAG          Image tag [default: latest]"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  $0                                          # Build production image"
    echo "  $0 -t development                          # Build development image"
    echo "  $0 -t production -p                        # Build and push production image"
    echo "  $0 -t production -T v1.0.0 -p             # Build and push with custom tag"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--target)
            TARGET="$2"
            shift 2
            ;;
        -p|--push)
            PUSH=true
            shift
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -n|--name)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -T|--tag)
            TAG="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate target
if [[ "$TARGET" != "development" && "$TARGET" != "production" ]]; then
    print_error "Invalid target: $TARGET. Must be 'development' or 'production'"
    exit 1
fi

# Build variables
FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}:${TAG}"
BUILD_ARGS="--target ${TARGET}"

print_status "Starting Docker build..."
print_status "Target: ${TARGET}"
print_status "Image: ${FULL_IMAGE_NAME}"
print_status "Push: ${PUSH}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if we're in the right directory
if [[ ! -f "packages/web/Dockerfile" ]]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

# Build the image
print_status "Building Docker image..."
if docker build ${BUILD_ARGS} -t "${FULL_IMAGE_NAME}" -f packages/web/Dockerfile .; then
    print_success "Docker image built successfully: ${FULL_IMAGE_NAME}"
else
    print_error "Docker build failed"
    exit 1
fi

# Get image information
IMAGE_SIZE=$(docker images "${FULL_IMAGE_NAME}" --format "{{.Size}}")
print_status "Image size: ${IMAGE_SIZE}"

# Push if requested
if [[ "$PUSH" == "true" ]]; then
    print_status "Pushing image to registry..."
    if docker push "${FULL_IMAGE_NAME}"; then
        print_success "Image pushed successfully: ${FULL_IMAGE_NAME}"
    else
        print_error "Failed to push image"
        exit 1
    fi
fi

# Show final status
print_success "Build completed successfully!"
print_status "Image: ${FULL_IMAGE_NAME}"
print_status "Size: ${IMAGE_SIZE}"

# Show how to run the image
echo ""
print_status "To run the image:"
if [[ "$TARGET" == "development" ]]; then
    echo "  docker run -p 4321:4321 -v \$(pwd)/packages/web/src:/app/packages/web/src ${FULL_IMAGE_NAME}"
else
    echo "  docker run -p 4321:4321 -e MONGO_URI=your_mongo_uri ${FULL_IMAGE_NAME}"
fi

echo ""
print_status "To run with docker-compose:"
if [[ "$TARGET" == "development" ]]; then
    echo "  docker-compose up"
else
    echo "  docker-compose -f docker-compose.yml -f docker-compose.prod.yml up"
fi