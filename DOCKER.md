# Docker Setup for Biodiversidade-Online

This guide covers the complete Docker setup for the Biodiversidade-Online project, including development and production configurations.

## 🚀 Quick Start

### Development Environment

```bash
# 1. Clone and setup
git clone https://github.com/biopinda/Biodiversidade-Online.git
cd Biodiversidade-Online

# 2. Copy environment file
cp .env.example .env

# 3. Start development environment
./scripts/docker-dev.sh up

# Access the application
# Web App: http://localhost:4321
# MongoDB Express: http://localhost:8081 (with --profile admin)
```

### Production Environment

```bash
# Build and run production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 📁 Docker Files Structure

```
├── packages/web/Dockerfile          # Multi-stage Dockerfile
├── docker-compose.yml               # Development configuration
├── docker-compose.prod.yml          # Production overrides
├── .env.example                     # Environment template
├── config/mongod.conf               # MongoDB production config
├── scripts/
│   ├── docker-build.sh             # Build helper script
│   ├── docker-dev.sh               # Development helper script
│   └── mongo-init.js               # MongoDB initialization
└── DOCKER.md                       # This documentation
```

## 🏗️ Dockerfile Features

### Multi-Stage Build

The Dockerfile uses a multi-stage build with the following stages:

1. **Base** - Security updates and non-root user setup
2. **Dependencies** - Install and cache dependencies
3. **Builder** - Build the application
4. **Production** - Optimized runtime image
5. **Development** - Development environment with hot reload

### Security Features

- ✅ Non-root user (`biodiversidade`)
- ✅ Alpine Linux base for smaller attack surface
- ✅ Security updates applied
- ✅ dumb-init for proper signal handling
- ✅ Health checks included
- ✅ Minimal runtime dependencies

### Performance Optimizations

- ✅ Layer caching for dependencies
- ✅ Multi-stage builds for smaller final image
- ✅ Build verification steps
- ✅ Optimized file copying order
- ✅ Production-only dependencies in final stage

## 🐳 Docker Compose Services

### Development Stack

| Service              | Port  | Description                     |
| -------------------- | ----- | ------------------------------- |
| `biodiversidade-web` | 4321  | Web application with hot reload |
| `mongodb`            | 27017 | MongoDB database                |
| `mongo-express`      | 8081  | Database admin UI (optional)    |

### Key Features

- **Hot Reload**: Source code changes automatically reflected
- **Volume Mounts**: Preserve node_modules and enable live editing
- **Health Checks**: Automatic service health monitoring
- **Network Isolation**: Services communicate via internal network
- **Data Persistence**: MongoDB data persisted in volumes

## 🛠️ Helper Scripts

### Docker Development Script

```bash
# Start development environment
./scripts/docker-dev.sh up

# View logs
./scripts/docker-dev.sh logs -f

# Open shell in web container
./scripts/docker-dev.sh shell

# Open MongoDB shell
./scripts/docker-dev.sh db-shell

# Clean up resources
./scripts/docker-dev.sh clean

# Full list of commands
./scripts/docker-dev.sh --help
```

### Docker Build Script

```bash
# Build production image
./scripts/docker-build.sh

# Build development image
./scripts/docker-build.sh -t development

# Build and push to registry
./scripts/docker-build.sh -p

# Custom tag and registry
./scripts/docker-build.sh -T v1.0.0 -r ghcr.io -p
```

## 🌍 Environment Configuration

### Required Environment Variables

```bash
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/biodiversidade
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your_secure_password
MONGO_DATABASE=biodiversidade

# Application Configuration
NODE_ENV=development
PORT=4321
HOST=0.0.0.0

# Optional: AI Service Keys
OPENAI_API_KEY=your_key_here
GOOGLE_AI_API_KEY=your_key_here
```

### Development vs Production

| Variable                   | Development                              | Production       |
| -------------------------- | ---------------------------------------- | ---------------- |
| `NODE_ENV`                 | `development`                            | `production`     |
| `ASTRO_TELEMETRY_DISABLED` | `1`                                      | `1`              |
| `MONGO_URI`                | `mongodb://mongodb:27017/biodiversidade` | External MongoDB |

## 🔧 Build Targets

### Production Target

Optimized for deployment:

```bash
docker build --target production -t biodiversidade:prod .
```

- ✅ Minimal runtime image
- ✅ No development dependencies
- ✅ Optimized performance
- ✅ Security hardened

### Development Target

Optimized for local development:

```bash
docker build --target development -t biodiversidade:dev .
```

- ✅ Hot reload enabled
- ✅ Development tools included
- ✅ Source code mounting
- ✅ Debug capabilities

## 📊 Monitoring and Health Checks

### Application Health

```bash
# Check application health
curl http://localhost:4321/api/health

# Docker health status
docker ps
```

### Service Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f biodiversidade-web
docker-compose logs -f mongodb
```

### Resource Usage

```bash
# Container stats
./scripts/docker-dev.sh status

# Detailed resource usage
docker stats
```

## 🚚 Production Deployment

### Using Docker Compose

```bash
# 1. Set production environment variables
export MONGO_URI="mongodb://prod-server:27017/biodiversidade"
export MONGO_ROOT_USERNAME="prod_admin"
export MONGO_ROOT_PASSWORD="secure_password"

# 2. Deploy
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 3. Verify deployment
docker-compose ps
```

### Using Pre-built Images

```bash
# Pull and run production image
docker run -d \
  --name biodiversidade-web \
  -p 4321:4321 \
  -e MONGO_URI="your_mongo_uri" \
  ghcr.io/biopinda/biodiversidade-online:latest
```

### CI/CD Integration

The project includes GitHub Actions for automatic building and deployment:

- **Build Trigger**: Changes to `packages/web/**`
- **Registry**: GitHub Container Registry (ghcr.io)
- **Deployment**: Automatic via SSH and Watchtower

## 🔍 Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port 4321
lsof -i :4321
# Or on Windows
netstat -ano | findstr :4321

# Kill process and restart
./scripts/docker-dev.sh restart
```

#### MongoDB Connection Issues

```bash
# Check MongoDB status
docker-compose logs mongodb

# Reset MongoDB data
docker-compose down -v
./scripts/docker-dev.sh up
```

#### Build Failures

```bash
# Clean build
./scripts/docker-dev.sh clean
./scripts/docker-dev.sh rebuild

# Check disk space
docker system df
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Optimize Docker Desktop (if applicable)
# - Increase memory allocation
# - Enable VirtioFS (macOS)
# - Use WSL2 backend (Windows)
```

### Network Issues

```bash
# Check network configuration
docker network ls
docker network inspect biodiversidade-network

# Reset network
docker-compose down
docker network prune
./scripts/docker-dev.sh up
```

## 📝 Best Practices

### Development

1. **Use Helper Scripts**: Leverage `./scripts/docker-dev.sh` for common tasks
2. **Volume Mounting**: Keep source code changes in sync
3. **Environment Files**: Never commit sensitive data in .env files
4. **Health Checks**: Monitor service health regularly
5. **Resource Limits**: Set appropriate limits for development containers

### Production

1. **Security**: Use non-root users and minimal base images
2. **Secrets**: Use external secret management
3. **Monitoring**: Implement comprehensive logging and monitoring
4. **Backup**: Regular database backups
5. **Updates**: Keep base images and dependencies updated

### Maintenance

1. **Regular Cleanup**: Use `docker system prune` regularly
2. **Image Updates**: Rebuild images when base images are updated
3. **Dependency Updates**: Keep package dependencies current
4. **Security Scanning**: Scan images for vulnerabilities
5. **Documentation**: Keep this documentation updated

## 🔗 Related Documentation

- [Main README](./README.md) - Project overview and setup
- [CLAUDE.md](./CLAUDE.md) - AI assistant instructions
- [GitHub Actions](./.github/workflows/) - CI/CD workflows
- [MongoDB Documentation](https://docs.mongodb.com/) - Database configuration
