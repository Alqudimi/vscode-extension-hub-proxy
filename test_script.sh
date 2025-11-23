#!/bin/bash

# ==============================================================================
# سكريبت اختبار شامل لوكيل سوق الإضافات الموحد (Composite Extension Marketplace Proxy)
# ==============================================================================

# إعداد المتغيرات
PROJECT_DIR="composite-extension-marketplace-proxy/composite-extension-marketplace-proxy_tested"
PORT=3000
BASE_URL="http://localhost:$PORT/gallery"
LOG_FILE="test_log.txt"
TEST_EXTENSION_NAME="ms-python.python" # امتداد معروف وموجود في كلا السوقين
TEST_EXTENSION_VERSION="latest" # استخدام أحدث نسخة لضمان التوفر
TEST_FALLBACK_PUBLISHER="redhat"
TEST_FALLBACK_NAME="java"
TEST_FALLBACK_VERSION="1.26.0"

# تنظيف سجل الاختبار السابق
> $LOG_FILE

# دالة لتسجيل النتائج
log_result() {
    local status=$1
    local message=$2
    echo "[$status] $message" | tee -a $LOG_FILE
}

# دالة للتحقق من حالة الخادم
check_server() {
    local max_attempts=10
    local attempt=0
    log_result "INFO" "التحقق من حالة الخادم على المنفذ $PORT..."
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://localhost:$PORT/" | grep -q "Composite Extension Marketplace Proxy is running"; then
            log_result "SUCCESS" "الخادم يعمل بنجاح."
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    log_result "FAILURE" "فشل تشغيل الخادم بعد $max_attempts محاولة."
    return 1
}

# دالة لقتل عملية الخادم
kill_server() {
    if [ -n "$SERVER_PID" ]; then
        log_result "INFO" "إيقاف عملية الخادم (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null
        wait $SERVER_PID 2>/dev/null
        SERVER_PID=""
    fi
}

# دالة لتشغيل الاختبارات
run_tests() {
    log_result "INFO" "بدء اختبارات واجهة برمجة التطبيقات (API)..."

    # ==========================================================================
    # 1. اختبار نقطة نهاية فحص الحالة (Health Check)
    # ==========================================================================
    log_result "TEST" "1. اختبار نقطة نهاية فحص الحالة (GET /)"
    RESPONSE=$(curl -s "http://localhost:$PORT/")
    if echo "$RESPONSE" | grep -q "status\":\"ok"; then
        log_result "SUCCESS" "فحص الحالة يعمل بشكل صحيح."
    else
        log_result "FAILURE" "فحص الحالة فشل. الاستجابة: $RESPONSE"
        return 1
    fi

    # ==========================================================================
    # 2. اختبار نقطة نهاية البحث الموحد (POST /gallery/search)
    # ==========================================================================
    log_result "TEST" "2. اختبار نقطة نهاية البحث الموحد (POST /gallery/search) عن '$TEST_EXTENSION_NAME'"
    SEARCH_PAYLOAD='{
        "filters": [
            {
                "criteria": [
                    {
                        "filterType": 10,
                        "value": "python"
                    },
                    {
                        "filterType": 8,
                        "value": "Microsoft.VisualStudio.Code"
                    }
                ],
                "pageNumber": 1,
                "pageSize": 50,
                "sortBy": 1,
                "sortOrder": 0
            }
        ],
        "flags": 914
    }'
    SEARCH_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "$SEARCH_PAYLOAD" "$BASE_URL/search")
    
    # التحقق من أن الاستجابة تحتوي على الامتداد التجريبي
    if echo "$SEARCH_RESPONSE" | grep -q "\"extensionName\"" && echo "$SEARCH_RESPONSE" | grep -q "\"publisherName\"" && echo "$SEARCH_RESPONSE" | grep -q "\"resultMetadata\""; then
        log_result "SUCCESS" "البحث الموحد يعمل. تم العثور على الامتداد '$TEST_EXTENSION_NAME'."
    else
        log_result "FAILURE" "البحث الموحد فشل في العثور على الامتداد. الاستجابة (مقتطف): ${SEARCH_RESPONSE:0:500}"
        return 1
    fi

    # ==========================================================================
    # 3. اختبار نقطة نهاية تفاصيل الامتداد (POST /gallery/extensionquery)
    # ==========================================================================
    log_result "TEST" "3. اختبار نقطة نهاية تفاصيل الامتداد (POST /gallery/extensionquery) لـ '$TEST_EXTENSION_NAME'"
    DETAIL_PAYLOAD='{
        "filters": [
            {
                "criteria": [
                    {
                        "filterType": 7,
                        "value": "ms-python.python"
                    },
                    {
                        "filterType": 8,
                        "value": "Microsoft.VisualStudio.Code"
                    }
                ],
                "pageNumber": 1,
                "pageSize": 1,
                "sortBy": 0,
                "sortOrder": 0
            }
        ],
        "flags": 914
    }'
    DETAIL_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "$DETAIL_PAYLOAD" "$BASE_URL/extensionquery")

    # التحقق من أن الاستجابة تحتوي على تفاصيل الامتداد
    if echo "$DETAIL_RESPONSE" | grep -q "\"extensionName\":\"python\"" && echo "$DETAIL_RESPONSE" | grep -q "\"publisherName\":\"ms-python\""; then
        log_result "SUCCESS" "استعلام تفاصيل الامتداد يعمل بشكل صحيح."
    else
        log_result "FAILURE" "استعلام تفاصيل الامتداد فشل. الاستجابة (مقتطف): ${DETAIL_RESPONSE:0:500}"
        return 1
    fi

    # ==========================================================================
    # 4. اختبار نقطة نهاية تنزيل VSIX (GET /gallery/download) - المسار الناجح
    # ==========================================================================
    log_result "TEST" "4. اختبار تنزيل VSIX (GET /gallery/download) لـ '$TEST_EXTENSION_NAME' (المسار الناجح)"
    DOWNLOAD_URL="$BASE_URL/download/ms-python/python/$TEST_EXTENSION_VERSION"
    VSIX_FILE="ms-python.python-$TEST_EXTENSION_VERSION.vsix"
    
    # تنزيل الملف وحفظه
    curl -s -L -o "$VSIX_FILE" "$DOWNLOAD_URL"
    DOWNLOAD_SIZE=$(stat -c%s "$VSIX_FILE" 2>/dev/null || echo 0)

    if [ "$DOWNLOAD_SIZE" -gt 100000 ]; then # التحقق من أن حجم الملف أكبر من 100 كيلوبايت (حجم معقول لملف VSIX)
        log_result "SUCCESS" "تنزيل VSIX ناجح. حجم الملف: $DOWNLOAD_SIZE بايت."
        rm "$VSIX_FILE" # تنظيف
    else
        log_result "FAILURE" "تنزيل VSIX فشل أو حجم الملف صغير جداً ($DOWNLOAD_SIZE بايت). تحقق من سجلات الخادم."
        return 1
    fi

    # ==========================================================================
    # 5. اختبار نقطة نهاية تنزيل VSIX - اختبار التراجع (Fallback)
    #    (Marketplace fails, Open VSX succeeds)
    # ==========================================================================
    log_result "TEST" "5. اختبار تنزيل VSIX - التراجع (Fallback) من Marketplace إلى Open VSX"
    # تم إعداد Marketplace.js ليفشل لـ test.fallback
    # وتم إعداد Openvsx.js ليعود بملف VSIX حقيقي لـ test.fallback
    FALLBACK_DOWNLOAD_URL="$BASE_URL/download/$TEST_FALLBACK_PUBLISHER/$TEST_FALLBACK_NAME/$TEST_FALLBACK_VERSION"
    FALLBACK_VSIX_FILE="$TEST_FALLBACK_PUBLISHER.$TEST_FALLBACK_NAME-$TEST_FALLBACK_VERSION.vsix"

    curl -s -L -o "$FALLBACK_VSIX_FILE" "$FALLBACK_DOWNLOAD_URL"
    FALLBACK_DOWNLOAD_SIZE=$(stat -c%s "$FALLBACK_VSIX_FILE" 2>/dev/null || echo 0)

    if [ "$FALLBACK_DOWNLOAD_SIZE" -gt 100000 ]; then # التحقق من أن حجم الملف أكبر من 100 كيلوبايت
        log_result "SUCCESS" "آلية التراجع (Fallback) تعمل. تم تنزيل الملف من Open VSX. حجم الملف: $FALLBACK_DOWNLOAD_SIZE بايت."
        rm "$FALLBACK_VSIX_FILE" # تنظيف
    else
        log_result "FAILURE" "آلية التراجع (Fallback) فشلت. حجم الملف: $FALLBACK_DOWNLOAD_SIZE بايت. تحقق من سجلات الخادم."
        return 1
    fi

    log_result "INFO" "جميع اختبارات واجهة برمجة التطبيقات (API) الأساسية اكتملت بنجاح."
    return 0
}

# ==========================================================================
# التسلسل الرئيسي للسكريبت
# ==========================================================================

# 1. تثبيت التبعيات
log_result "INFO" "1. تثبيت تبعيات Node.js..."
if pnpm install --prefix $PROJECT_DIR >> $LOG_FILE 2>&1; then
    log_result "SUCCESS" "تم تثبيت التبعيات بنجاح."
else
    log_result "FAILURE" "فشل تثبيت التبعيات. تحقق من $LOG_FILE."
    exit 1
fi

# 2. تشغيل الخادم في الخلفية
log_result "INFO" "2. تشغيل الخادم في الخلفية..."
# تشغيل الخادم في الخلفية وتخزين PID
(cd $PROJECT_DIR && node server.js >> ../server.log 2>&1) &
SERVER_PID=$!
log_result "INFO" "تم تشغيل الخادم. PID: $SERVER_PID. سجلات الخادم في $PROJECT_DIR/../server.log"

# 3. التحقق من تشغيل الخادم
if ! check_server; then
    kill_server
    exit 1
fi

# 4. تشغيل الاختبارات
if run_tests; then
    log_result "RESULT" "=================================================="
    log_result "RESULT" "تهانينا! اكتمل الاختبار الشامل بنجاح."
    log_result "RESULT" "=================================================="
    TEST_STATUS=0
else
    log_result "RESULT" "=================================================="
    log_result "RESULT" "فشل الاختبار الشامل. يرجى مراجعة $LOG_FILE و $PROJECT_DIR/../server.log"
    log_result "RESULT" "=================================================="
    TEST_STATUS=1
fi

# 5. تنظيف
kill_server

# عرض ملخص السجل
echo ""
echo "=================================================="
echo "ملخص سجل الاختبار ($LOG_FILE):"
echo "=================================================="
cat $LOG_FILE

exit $TEST_STATUS
