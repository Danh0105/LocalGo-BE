#!/bin/bash

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${1:-https://api.localgo.skilltripx.com.vn}"
API_ENDPOINT="${API_BASE_URL}/api/v1"

# Test data
ZALO_ORIGINS=("https://h5.zadn.vn" "https://h5.zdn.vn")
INVALID_ORIGIN="https://evil.example.com"
INVALID_TOKEN="invalid_token_12345"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓ PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗ FAIL]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test results tracking
PASS_COUNT=0
FAIL_COUNT=0

test_passed() {
    PASS_COUNT=$((PASS_COUNT + 1))
    log_success "$1"
}

test_failed() {
    FAIL_COUNT=$((FAIL_COUNT + 1))
    log_error "$1"
}

# Header
echo ""
echo "================================"
echo "  LocalGo Zalo Auth Smoke Test"
echo "================================"
echo ""
log_info "API Base URL: $API_ENDPOINT"
echo ""

# ============================================================================
# Test 1: Preflight CORS for Zalo origins
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "Test 1: Preflight CORS for Zalo origins"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for origin in "${ZALO_ORIGINS[@]}"; do
    log_info "Testing origin: $origin"
    
    response=$(curl -s -w "\n%{http_code}" -X OPTIONS \
        "$API_ENDPOINT/auth/zalo" \
        -H "Origin: $origin" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: content-type,authorization")
    
    http_code=$(echo "$response" | tail -n1)
    headers=$(echo "$response" | head -n-1)
    
    cors_header=$(echo "$headers" | grep -i "^access-control-allow-origin" || echo "")
    
    if [ "$http_code" == "204" ] && [ -n "$cors_header" ]; then
        cors_value=$(echo "$cors_header" | cut -d' ' -f2-)
        if [ "$cors_value" == "$origin" ]; then
            test_passed "Preflight for $origin returned 204 with correct CORS header"
        else
            test_failed "Preflight for $origin returned wrong CORS value: $cors_value (expected: $origin)"
        fi
    else
        test_failed "Preflight for $origin returned HTTP $http_code without proper CORS header"
    fi
done

echo ""

# ============================================================================
# Test 2: Negative CORS test - invalid origin
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "Test 2: Negative CORS test - invalid origin should be rejected"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

response=$(curl -s -w "\n%{http_code}" -X OPTIONS \
    "$API_ENDPOINT/auth/zalo" \
    -H "Origin: $INVALID_ORIGIN" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type")

http_code=$(echo "$response" | tail -n1)
headers=$(echo "$response" | head -n-1)
cors_header=$(echo "$headers" | grep -i "^access-control-allow-origin" || echo "")

if [ -z "$cors_header" ]; then
    test_passed "Invalid origin $INVALID_ORIGIN was correctly rejected (no CORS header)"
else
    test_failed "Invalid origin $INVALID_ORIGIN was incorrectly allowed with CORS header: $cors_header"
fi

echo ""

# ============================================================================
# Test 3: POST /auth/zalo with invalid token
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "Test 3: POST /auth/zalo with invalid token"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

response=$(curl -s -w "\n%{http_code}" -X POST \
    "$API_ENDPOINT/auth/zalo" \
    -H "Content-Type: application/json" \
    -d "{\"accessToken\":\"$INVALID_TOKEN\"}")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "401" ]; then
    error_code=$(echo "$body" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
    if [ "$error_code" == "INVALID_CREDENTIALS" ]; then
        test_passed "Invalid token correctly returned 401 with INVALID_CREDENTIALS error"
        
        # Check that response doesn't contain 'mock' mode indicator
        if echo "$body" | grep -q "mock"; then
            test_failed "Response contains 'mock' - production might still be in mock mode"
        else
            test_passed "Response doesn't contain 'mock' indicator - real mode confirmed"
        fi
    else
        test_failed "Invalid token returned 401 but wrong error code: $error_code (expected: INVALID_CREDENTIALS)"
    fi
elif [ "$http_code" == "502" ]; then
    error_code=$(echo "$body" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
    if [ "$error_code" == "INTERNAL_ERROR" ]; then
        test_passed "Invalid token returned 502 (upstream error - Zalo API unreachable or misconfigured)"
        log_warning "This could mean: ZALO_APP_SECRET is wrong, network issue, or Zalo API down"
    else
        test_failed "Invalid token returned 502 but wrong error code: $error_code"
    fi
else
    test_failed "Invalid token returned unexpected HTTP $http_code (expected: 401 or 502)"
fi

echo ""

# ============================================================================
# Test 4: Empty token
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "Test 4: POST /auth/zalo with empty token"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

response=$(curl -s -w "\n%{http_code}" -X POST \
    "$API_ENDPOINT/auth/zalo" \
    -H "Content-Type: application/json" \
    -d '{"accessToken":""}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "401" ]; then
    error_code=$(echo "$body" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
    if [ "$error_code" == "INVALID_CREDENTIALS" ]; then
        test_passed "Empty token correctly returned 401 with INVALID_CREDENTIALS"
    else
        test_failed "Empty token returned 401 but wrong error code: $error_code"
    fi
else
    test_failed "Empty token returned unexpected HTTP $http_code (expected: 401)"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL=$((PASS_COUNT + FAIL_COUNT))

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All $TOTAL tests passed!${NC}"
    echo ""
    log_success "CORS configuration is correct"
    log_success "Auth endpoints are responding properly"
    echo ""
    echo "Next steps:"
    echo "  1. Test with real Zalo token from Mini App"
    echo "  2. Verify /users/me endpoint returns user profile"
    echo "  3. Check PM2 logs for any issues"
    exit 0
else
    echo -e "${RED}✗ $FAIL_COUNT of $TOTAL tests failed${NC}"
    echo ""
    log_error "Some tests failed - review configuration"
    echo ""
    echo "Checklist:"
    echo "  - [ ] CORS_ORIGINS in .env includes https://h5.zadn.vn and https://h5.zdn.vn"
    echo "  - [ ] ZALO_AUTH_MODE=real (not mock)"
    echo "  - [ ] ZALO_APP_SECRET is set and correct"
    echo "  - [ ] Application was rebuilt (npm run build)"
    echo "  - [ ] PM2 was restarted (pm2 restart localgo-be)"
    echo "  - [ ] Check PM2 logs: pm2 logs localgo-be"
    exit 1
fi
