// UPER Home Portal production build pipeline.
// This job validates and packages the production artifact; Kubernetes rollout is intentionally out of scope.
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }

    environment {
        APP_NAME = 'uper-home-portal'
        ENV = 'prod'
        APP_ENV = 'prod'
        TZ = 'Asia/Jakarta'
        BRANCH = 'main'
        GIT_URL = 'git@github.com:uper-edu/uper-home-portal.git'
        NODE_IMAGE = 'node:24.19.0-bookworm-slim'
        BUILD_DIR = 'build/prod'

        DEPLOY_REGISTRY_TYPE = 'internal'
        REGISTRY_INTERNAL = 'zot.internal.uperedu.com'
        REGISTRY_EXTERNAL = 'zot.internal.uperedu.com'
        IMAGE_NAMESPACE = 'prod-uper'
        REG_CRED = 'zot-registry'
        PUSH_IMAGE = 'true'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout([$class: 'GitSCM',
                    branches: [[name: "*/${env.BRANCH}"]],
                    userRemoteConfigs: [[url: env.GIT_URL]],
                    extensions: [[$class: 'CloneOption', shallow: true, depth: 1, noTags: true, timeout: 30]]
                ])
            }
        }

        stage('Init') {
            steps {
                script {
                    env.REGISTRY = env.DEPLOY_REGISTRY_TYPE == 'external' ? env.REGISTRY_EXTERNAL : env.REGISTRY_INTERNAL
                    env.IMAGE_REPO = "${env.REGISTRY}/${env.IMAGE_NAMESPACE}/${env.APP_NAME}"
                    env.GIT_SHA = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
                    env.BUILD_TS = sh(returnStdout: true, script: 'date +%Y%m%d_%H%M%S').trim()
                    env.VERSION = "${env.BUILD_TS}_${env.GIT_SHA}"
                    env.IMG_IMMUTABLE = "${env.IMAGE_REPO}:${env.VERSION}"
                    echo "ENV=${env.ENV} REGISTRY=${env.REGISTRY} VERSION=${env.VERSION}"
                    echo "IMAGE=${env.IMG_IMMUTABLE}"
                }
            }
        }

        stage('Test and Build Production Package') {
            steps {
                sh '''
                    set -eu
                    if [ ! -f .env.prod ]; then
                        cp .env.prod.example .env.prod
                    fi
                    mkdir -p .local-backups/ci-private-tmp
                    restore_workspace_permissions() {
                        chown -R "$(id -u):$(id -g)" "$WORKSPACE/.local-backups" "$WORKSPACE/node_modules" "$WORKSPACE/build" 2>/dev/null || true
                    }
                    trap restore_workspace_permissions EXIT
                    docker run --rm \\
                        -e HOME=/tmp \\
                        -e npm_config_cache=/tmp/npm-cache \\
                        -v "$WORKSPACE:/workspace" \\
                        -v "$WORKSPACE/.local-backups/ci-private-tmp:/private/tmp" \\
                        -w /workspace \\
                        "$NODE_IMAGE" sh -ec '
                            set -eu
                            apt-get update
                            apt-get install -y --no-install-recommends git ca-certificates
                            git config --global --add safe.directory /workspace
                            node --version
                            npm --version
                            npm ci --ignore-scripts
                            npm test
                            npm run lint
                            npm run build:prod
                            git diff --check
                            test -f build/prod/Dockerfile
                            test -f build/prod/runtime/server.mjs
                            test -f build/prod/web/index.html
                            test ! -e build/prod/.env.prod
                        '
                '''
            }
        }

        stage('Docker Build and Push') {
            when {
                environment name: 'PUSH_IMAGE', value: 'true'
            }
            steps {
                withCredentials([usernamePassword(credentialsId: env.REG_CRED, usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
                    sh '''
                        set -eu
                        export DOCKER_CONFIG="$WORKSPACE/.docker-cfg"
                        cleanup() {
                            docker logout "$REGISTRY" >/dev/null 2>&1 || true
                            rm -rf "$DOCKER_CONFIG"
                        }
                        trap cleanup EXIT
                        mkdir -p "$DOCKER_CONFIG"
                        printf '%s' "$REG_PASS" | docker login "$REGISTRY" -u "$REG_USER" --password-stdin
                        docker build --pull=false -t "$IMG_IMMUTABLE" "$BUILD_DIR"
                        docker push "$IMG_IMMUTABLE"
                    '''
                }
            }
        }

        stage('Cleanup Local Image') {
            steps {
                sh 'docker rmi -f "$IMG_IMMUTABLE" 2>/dev/null || true'
            }
        }
    }

    post {
        always {
            echo "Build result: ${currentBuild.currentResult}; image: ${env.IMG_IMMUTABLE ?: '-'}"
        }
    }
}
