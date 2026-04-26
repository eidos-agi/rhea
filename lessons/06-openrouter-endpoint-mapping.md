# Lesson 6: OpenRouter Endpoint Mapping

## The Conflict
OpenRouter claims to be "OpenAI Compatible," suggesting that `/v1/images/generations` should work out of the box.

## What Failed
Calling the standard OpenAI image endpoint on OpenRouter resulted in a 404 HTML error page. This indicated that OpenRouter either uses a different path for its image generation models or expects them to be called via the Chat/Completions multimodal endpoint.

## The Lesson
"OpenAI Compatible" is a spectrum, not a binary. For image generation specifically, providers often deviate from the standard `/v1/images` path. Always test the specific endpoint mapping for multimodal providers before assuming a drop-in replacement will work.
