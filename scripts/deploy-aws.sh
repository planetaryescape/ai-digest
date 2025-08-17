#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/terraform/aws"
ARTIFACTS_DIR="$PROJECT_ROOT/terraform/artifacts"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 20.x"
        exit 1
    fi
    
    # Check for npm/bun
    if ! command -v npm &> /dev/null && ! command -v bun &> /dev/null; then
        print_error "npm or bun is not installed"
        exit 1
    fi
    
    # Check for Terraform
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform is not installed. Please install Terraform"
        exit 1
    fi
    
    # Check for AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install AWS CLI"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials are not configured. Please run 'aws configure'"
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Function to build Lambda functions
build_lambda() {
    print_status "Building Lambda functions..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        if command -v bun &> /dev/null; then
            bun install
        else
            npm install
        fi
    fi
    
    # Build Lambda functions
    if command -v bun &> /dev/null; then
        bun run build:aws
    else
        npm run build:aws
    fi
    
    # Verify Lambda package exists
    if [ ! -f "$ARTIFACTS_DIR/lambda.zip" ]; then
        print_error "Lambda package not found at $ARTIFACTS_DIR/lambda.zip"
        exit 1
    fi
    
    # Check package size
    PACKAGE_SIZE=$(du -h "$ARTIFACTS_DIR/lambda.zip" | cut -f1)
    print_status "Lambda package size: $PACKAGE_SIZE"
    
    # Warn if package is too large
    PACKAGE_SIZE_MB=$(du -m "$ARTIFACTS_DIR/lambda.zip" | cut -f1)
    if [ "$PACKAGE_SIZE_MB" -gt 50 ]; then
        print_warning "Lambda package is larger than 50MB. Consider using Lambda Layers for dependencies"
    fi
    
    print_success "Lambda functions built successfully"
}

# Function to validate Terraform configuration
validate_terraform() {
    print_status "Validating Terraform configuration..."
    
    cd "$TERRAFORM_DIR"
    
    # Initialize Terraform
    print_status "Initializing Terraform..."
    terraform init -upgrade
    
    # Validate configuration
    if ! terraform validate; then
        print_error "Terraform validation failed"
        exit 1
    fi
    
    print_success "Terraform configuration is valid"
}

# Function to check required variables
check_variables() {
    print_status "Checking required variables..."
    
    cd "$TERRAFORM_DIR"
    
    # Check if terraform.tfvars exists
    if [ ! -f "terraform.tfvars" ]; then
        print_error "terraform.tfvars not found. Creating template..."
        cat > terraform.tfvars.example <<EOF
# AWS Configuration
aws_region = "us-east-1"

# Gmail OAuth Configuration
gmail_client_id     = "YOUR_GMAIL_CLIENT_ID"
gmail_client_secret = "YOUR_GMAIL_CLIENT_SECRET"
gmail_refresh_token = "YOUR_GMAIL_REFRESH_TOKEN"

# OpenAI Configuration
openai_api_key   = "YOUR_OPENAI_API_KEY"
helicone_api_key = "YOUR_HELICONE_API_KEY"

# Email Configuration
resend_api_key  = "YOUR_RESEND_API_KEY"
recipient_email = "your-email@example.com"
alert_email     = "alerts@example.com"

# Processing Configuration
older_than_days      = 30
max_links_per_email  = 2
max_sections         = 25
keywords             = ""
professions          = "Software Engineer,Product Manager,Designer"

# Optional: Override defaults
# lambda_timeout = 300
# lambda_memory  = 512
# log_retention_days = 7
# enable_xray = false
# use_dynamodb = false
# use_secrets_manager = false
EOF
        print_error "Please fill in terraform.tfvars with your configuration"
        exit 1
    fi
    
    print_success "Variable file found"
}

# Function to plan Terraform changes
plan_terraform() {
    print_status "Planning Terraform changes..."
    
    cd "$TERRAFORM_DIR"
    
    # Use the complete configuration if it exists
    if [ -f "main-complete.tf" ]; then
        print_status "Using complete configuration (main-complete.tf)"
        # Backup existing main.tf if it exists
        if [ -f "main.tf" ]; then
            mv main.tf main.tf.backup
        fi
        cp main-complete.tf main.tf
        
        # Use complete variables if they exist
        if [ -f "variables-complete.tf" ]; then
            if [ -f "variables.tf" ]; then
                mv variables.tf variables.tf.backup
            fi
            cp variables-complete.tf variables.tf
        fi
    fi
    
    # Run terraform plan
    terraform plan -out=tfplan
    
    print_success "Terraform plan generated"
    
    echo ""
    read -p "Do you want to apply these changes? (yes/no): " -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_warning "Deployment cancelled"
        exit 0
    fi
}

# Function to apply Terraform changes
apply_terraform() {
    print_status "Applying Terraform changes..."
    
    cd "$TERRAFORM_DIR"
    
    # Apply the plan
    terraform apply tfplan
    
    print_success "Terraform apply completed"
}

# Function to display outputs
display_outputs() {
    print_status "Deployment outputs:"
    
    cd "$TERRAFORM_DIR"
    
    echo ""
    echo "============================================================================"
    echo "DEPLOYMENT SUCCESSFUL!"
    echo "============================================================================"
    echo ""
    
    # Get outputs
    API_URL=$(terraform output -raw api_gateway_url 2>/dev/null || echo "N/A")
    API_KEY_ID=$(terraform output -raw api_key_id 2>/dev/null || echo "N/A")
    WEEKLY_FUNCTION=$(terraform output -raw weekly_digest_function_name 2>/dev/null || echo "N/A")
    RUN_NOW_FUNCTION=$(terraform output -raw run_now_function_name 2>/dev/null || echo "N/A")
    S3_BUCKET=$(terraform output -raw processed_emails_bucket 2>/dev/null || echo "N/A")
    DLQ_URL=$(terraform output -raw dlq_url 2>/dev/null || echo "N/A")
    DASHBOARD_URL=$(terraform output -raw cloudwatch_dashboard_url 2>/dev/null || echo "N/A")
    
    echo "🚀 Lambda Functions:"
    echo "   Weekly Digest: $WEEKLY_FUNCTION"
    echo "   Run Now: $RUN_NOW_FUNCTION"
    echo ""
    echo "🌐 API Gateway:"
    echo "   URL: $API_URL/run"
    echo "   API Key ID: $API_KEY_ID"
    echo ""
    echo "💾 Storage:"
    echo "   S3 Bucket: $S3_BUCKET"
    echo ""
    echo "📊 Monitoring:"
    echo "   Dashboard: $DASHBOARD_URL"
    echo "   DLQ: $DLQ_URL"
    echo ""
    echo "============================================================================"
    echo ""
    
    # Show how to get API key
    print_status "To get your API key value, run:"
    echo "   aws apigateway get-api-key --api-key $API_KEY_ID --include-value --region $AWS_REGION"
    echo ""
    
    # Show how to test
    print_status "To test the weekly digest function, run:"
    echo "   aws lambda invoke --function-name $WEEKLY_FUNCTION --region $AWS_REGION output.json"
    echo ""
    
    print_status "To trigger via API (after getting API key), run:"
    echo "   curl -X POST $API_URL/run -H \"x-api-key: YOUR_API_KEY\""
    echo ""
}

# Function to run tests
run_tests() {
    print_status "Running deployment tests..."
    
    cd "$TERRAFORM_DIR"
    
    # Test Lambda function
    WEEKLY_FUNCTION=$(terraform output -raw weekly_digest_function_name 2>/dev/null)
    if [ -n "$WEEKLY_FUNCTION" ]; then
        print_status "Testing Lambda function: $WEEKLY_FUNCTION"
        
        if aws lambda invoke \
            --function-name "$WEEKLY_FUNCTION" \
            --region "$AWS_REGION" \
            /tmp/lambda-test-output.json &> /dev/null; then
            
            # Check if there was an error
            if grep -q "errorMessage" /tmp/lambda-test-output.json; then
                print_warning "Lambda function executed but returned an error:"
                cat /tmp/lambda-test-output.json | jq '.' 2>/dev/null || cat /tmp/lambda-test-output.json
            else
                print_success "Lambda function test successful"
            fi
        else
            print_error "Failed to invoke Lambda function"
        fi
    fi
}

# Function to clean up
cleanup() {
    print_status "Cleaning up..."
    
    cd "$TERRAFORM_DIR"
    
    # Remove terraform plan file
    rm -f tfplan
    
    # Restore backup files if they exist
    if [ -f "main.tf.backup" ]; then
        rm -f main.tf
        mv main.tf.backup main.tf
    fi
    
    if [ -f "variables.tf.backup" ]; then
        rm -f variables.tf
        mv variables.tf.backup variables.tf
    fi
}

# Trap errors and cleanup
trap cleanup EXIT

# Main deployment flow
main() {
    echo ""
    echo "============================================================================"
    echo "AI DIGEST AWS DEPLOYMENT SCRIPT"
    echo "============================================================================"
    echo ""
    
    # Parse command line arguments
    case "${1:-}" in
        --destroy)
            print_warning "Destroying infrastructure..."
            cd "$TERRAFORM_DIR"
            terraform destroy
            print_success "Infrastructure destroyed"
            exit 0
            ;;
        --plan-only)
            check_prerequisites
            check_variables
            build_lambda
            validate_terraform
            plan_terraform
            print_success "Plan complete (not applied)"
            exit 0
            ;;
        --skip-build)
            print_warning "Skipping Lambda build"
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --destroy      Destroy all AWS resources"
            echo "  --plan-only    Only plan changes, don't apply"
            echo "  --skip-build   Skip Lambda build step"
            echo "  --help         Show this help message"
            echo ""
            exit 0
            ;;
    esac
    
    # Run deployment steps
    check_prerequisites
    check_variables
    
    if [ "${1:-}" != "--skip-build" ]; then
        build_lambda
    fi
    
    validate_terraform
    plan_terraform
    apply_terraform
    display_outputs
    run_tests
    
    print_success "Deployment completed successfully!"
}

# Run main function
main "$@"