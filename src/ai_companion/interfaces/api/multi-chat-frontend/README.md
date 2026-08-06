# Multi Chat Frontend

واجهة محادثة حديثة وبسيطة مبنية باستخدام `HTML` و`CSS` و`JavaScript` فقط، ومصممة للاتصال بـ FastAPI Chat API.

## API المستخدم

الطلب الافتراضي:

```http
POST http://localhost:8001/v1/chat/text
Content-Type: application/json
```

جسم الطلب:

```json
{
  "text": "Hello",
  "thread_id": "thread-unique-id"
}
```

ينشئ التطبيق `thread_id` مستقلًا لكل محادثة، ويرسل نفس المعرّف مع كل الرسائل التابعة لها.

## ملفات المشروع

```text
multi-chat-frontend/
├── index.html
├── styles.css
├── app.js
└── README.md
```

## التشغيل

افتح Terminal داخل مجلد المشروع، ثم شغّل خادمًا محليًا:

```bash
python -m http.server 5500
```

بعد ذلك افتح هذا العنوان في المتصفح:

```text
http://localhost:5500
```

لا يُفضّل فتح `index.html` مباشرة باستخدام `file://` لأن بعض خصائص المتصفح وطلبات الشبكة قد لا تعمل بصورة صحيحة.

## إعداد الاتصال

من قسم **إعدادات الاتصال** داخل الواجهة يمكنك تعديل:

- `Base URL`: القيمة الافتراضية هي `http://localhost:8001`
- `Endpoint`: القيمة الافتراضية هي `/v1/chat/text`

اضغط **حفظ الإعدادات** بعد التعديل.

## المميزات

- إنشاء عدة محادثات مستقلة.
- `thread_id` مختلف لكل محادثة.
- التنقل بين المحادثات أثناء انتظار رد محادثة أخرى.
- حفظ المحادثات والإعدادات داخل `localStorage`.
- البحث في المحادثات وحذفها ومسح رسائلها.
- تصميم RTL حديث ومتجاوب مع الهاتف.
- مهلة طلب مقدارها 60 ثانية.
- عرض رسائل أخطاء الاتصال وHTTP.
- دعم عدة أشكال شائعة لاستجابة API، مثل:

```json
{ "response": "Assistant reply" }
```

```json
{ "answer": "Assistant reply" }
```

```json
{ "message": "Assistant reply" }
```

```json
{
  "data": {
    "response": "Assistant reply"
  }
}
```

وإذا كان شكل الاستجابة مختلفًا، سيعرض التطبيق JSON كاملًا داخل المحادثة.

## تفعيل CORS في FastAPI

إذا ظهر الخطأ `Failed to fetch`، فتأكد أولًا أن FastAPI يعمل على المنفذ `8001`، ثم فعّل CORS:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

أثناء التطوير فقط، يمكن استخدام:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## اختبار API مباشرة

يمكن اختبار الـ endpoint قبل تشغيل الواجهة:

```bash
curl -X POST "http://localhost:8001/v1/chat/text" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello","thread_id":"test-thread"}'
```

## ملاحظات

- البيانات محفوظة في نفس المتصفح والجهاز فقط.
- مسح بيانات الموقع من المتصفح سيحذف المحادثات المحفوظة.
- المشروع لا يحتاج إلى npm أو أي مكتبات JavaScript خارجية.
