#!/bin/bash

# =============================================================================
# Docker Development Helper Script for Biodiversidade-Online
# =============================================================================

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Docker development helper for Biodiversidade-Online"
    echo ""
    echo "COMMANDS:"
    echo "  up           Start development environment"
    echo "  down         Stop development environment"
    echo "  restart      Restart development environment"
    echo "  logs         Show logs from all services"
    echo "  logs-web     Show logs from web service only"
    echo "  logs-db      Show logs from database only"
    echo "  shell        Open shell in web container"
    echo "  db-shell     Open MongoDB shell"
    echo "  clean        Clean up Docker resources"
    echo "  rebuild      Rebuild and restart services"
    echo "  status       Show status of services"
    echo ""
    echo "EXAMPLES:"
    echo "  $0 up                    # Start development environment"
    echo "  $0 logs -f               # Follow logs from all services"
    echo "  $0 shell                 # Open shell in web container"
}

# Check if we're in the right directory
if [[ ! -f "docker-compose.yml" ]]; then
    print_warning "This script should be run from the project root directory"
    exit 1
fi

# Check if .env file exists
if [[ ! -f ".env" ]]; then
    print_warning "No .env file found. Creating from .env.example..."
    if [[ -f ".env.example" ]]; then
        cp .env.example .env
        print_success "Created .env file from .env.example"
        print_warning "Please edit .env file with your configuration"
    else
        print_warning "No .env.example file found either"
    fi
fi

COMMAND=${1:-up}

case $COMMAND in
    up)
        print_status "Starting development environment..."
        docker-compose up -d
        print_success "Development environment started!"
        print_status "Web application: http://localhost:4321"
        print_status "MongoDB Express: http://localhost:8081 (use --profile admin to enable)"
        echo ""
        print_status "To see logs: $0 logs"
        print_status "To stop: $0 down"
        ;;

    down)
        print_status "Stopping development environment..."
        docker-compose down
        print_success "Development environment stopped!"
        ;;

    restart)
        print_status "Restarting development environment..."
        docker-compose restart
        print_success "Development environment restarted!"
        ;;

    logs)
        shift
        docker-compose logs "$@"
        ;;

    logs-web)
        shift
        docker-compose logs biodiversidade-web "$@"
        ;;

    logs-db)
        shift
        docker-compose logs mongodb "$@"
        ;;

    shell)
        print_status "Opening shell in web container..."
        docker-compose exec biodiversidade-web sh
        ;;

    db-shell)
        print_status "Opening MongoDB shell..."
        docker-compose exec mongodb mongosh
        ;;

    clean)
        print_status "Cleaning up Docker resources..."
        docker-compose down -v
        docker system prune -f
        print_success "Docker resources cleaned!"
        ;;

    rebuild)
        print_status "Rebuilding and restarting services..."
        docker-compose down
        docker-compose build --no-cache
        docker-compose up -d
        print_success "Services rebuilt and restarted!"
        ;;

    status)
        print_status "Service status:"
        docker-compose ps
        echo ""
        print_status "Resource usage:"
        docker stats --no-stream
        ;;

    admin)
        print_status "Starting with admin tools (MongoDB Express)..."
        docker-compose --profile admin up -d
        print_success "Development environment with admin tools started!"
        print_status "Web application: http://localhost:4321"
        print_status "MongoDB Express: http://localhost:8081"
        ;;

    *)
        echo "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac