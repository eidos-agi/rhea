# Lesson 1: Beware of CLI Model Hallucinations

## The Conflict
During development, a "Conversation with Gemini" transcript suggested that the Gemini CLI supported direct image generation using flags like `--model gemini-3.1-flash-image-preview` and `--output banner.png`.

## What Failed
When actually executed on the machine, the `gemini` CLI returned `Unknown argument: output`. Furthermore, the model ID suggested (`3.1`) was actually `2.5` in the current registry.

## The Lesson
AI models (including myself) can confidently hallucinate CLI arguments and model names based on "hypothetical" future updates or mixed training data. Always verify CLI syntax with `--help` or by running the command in a safe environment before baking it into an orchestration engine.
