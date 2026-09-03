# Chatbot API

## Gửi tin nhắn

`POST /api/v1/chatbot/messages`

Endpoint công khai, giới hạn 10 request/phút cho mỗi client.

```json
{
  "message": "Ở Truông Mít có địa điểm nào nên tham quan?",
  "history": [
    { "role": "user", "content": "Xin chào" },
    { "role": "assistant", "content": "Chào bạn!" }
  ]
}
```

`history` là tùy chọn, tối đa 10 tin nhắn. Client nên gửi các lượt gần nhất để
chatbot hiểu ngữ cảnh.

Phản hồi:

```json
{
  "data": {
    "message": "Nội dung trả lời của trợ lý...",
    "model": "gpt-5-nano"
  }
}
```

## Cấu hình backend

```dotenv
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-nano
OPENAI_MAX_OUTPUT_TOKENS=800
```

Không đưa `OPENAI_API_KEY` vào source code, frontend hoặc Zalo Mini App.

Chatbot chỉ trả lời trong phạm vi du lịch và thông tin địa phương. Mỗi request
được bổ sung toàn bộ dữ liệu công khai đang hoạt động về điểm tham quan, đặc
sản, ẩm thực, OCOP, làng nghề, lễ hội, nông nghiệp, tour, bản đồ, liên hệ, tin
tức và trang giới thiệu. Dữ liệu được cache 5 phút để giảm tải database.
