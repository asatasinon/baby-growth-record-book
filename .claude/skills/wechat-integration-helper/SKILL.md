---
name: wechat-integration-helper
description: Validate WeChat API configurations and generate integration code
disable-model-invocation: true
tools: Read, Bash
---

# WeChat Integration Helper

Validate WeChat API configurations and generate integration code for WeChat mini-program authentication and API calls.

## When to Use

Use this skill when:
- Setting up WeChat mini-program authentication
- Validating WeChat App ID and App Secret configuration
- Generating WeChat OAuth integration code
- Testing WeChat API connectivity
- Debugging WeChat authentication issues

## Workflow

1. **Validate environment configuration**:
   - Check `.env` or `.env.example` for `WECHAT_APP_ID` and `WECHAT_APP_SECRET`
   - Verify configuration format and placeholders
   - Suggest secure storage practices for secrets

2. **Generate integration code**:
   - Create WeChat OAuth authentication service
   - Generate mini-program login flow implementation
   - Create API client for WeChat backend calls
   - Generate error handling for WeChat API failures

3. **Test connectivity**:
   - Provide commands to test WeChat API connectivity
   - Generate test cases for authentication flow
   - Create mock responses for development testing

## Example Output

### Configuration Validation
```bash
# Check WeChat configuration
if [ -z "$WECHAT_APP_ID" ] || [ "$WECHAT_APP_ID" = "replace-me" ]; then
  echo "ERROR: WECHAT_APP_ID not configured"
  exit 1
fi

if [ -z "$WECHAT_APP_SECRET" ] || [ "$WECHAT_APP_SECRET" = "replace-me" ]; then
  echo "ERROR: WECHAT_APP_SECRET not configured"
  exit 1
fi

echo "WeChat configuration validated successfully"
```

### Integration Code Snippet
```python
import httpx
from typing import Optional
from pydantic import BaseModel

class WeChatAuthResponse(BaseModel):
    openid: str
    session_key: str
    unionid: Optional[str] = None

class WeChatAuthService:
    def __init__(self, app_id: str, app_secret: str):
        self.app_id = app_id
        self.app_secret = app_secret
        self.base_url = "https://api.weixin.qq.com"

    async def code_to_session(self, js_code: str) -> WeChatAuthResponse:
        """Exchange JS code for session key and openid"""
        url = f"{self.base_url}/sns/jscode2session"
        params = {
            "appid": self.app_id,
            "secret": self.app_secret,
            "js_code": js_code,
            "grant_type": "authorization_code"
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            if "errcode" in data and data["errcode"] != 0:
                raise ValueError(f"WeChat API error: {data.get('errmsg', 'Unknown error')}")

            return WeChatAuthResponse(**data)
```

## Usage

Run `/wechat-integration-helper` to:
1. Validate current WeChat configuration
2. Generate integration code for authentication
3. Provide testing commands and examples

## Notes

- Requires valid WeChat App ID and App Secret from WeChat Open Platform
- Generated code follows FastAPI async patterns
- Includes proper error handling for WeChat API failures
- Supports both mini-program and official account authentication