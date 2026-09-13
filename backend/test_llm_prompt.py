from llm import build_llm_content


def test_build_llm_content_includes_tool_prompt_by_default():
    content = build_llm_content("What is the weather?", [{"name": "get_weather"}])

    assert "User message: What is the weather?" in content
    assert "Answer Using a tool from the available tools" in content


def test_build_llm_content_can_omit_tool_prompt():
    content = build_llm_content(
        "What is the weather?",
        [{"name": "get_weather"}],
        require_tool_choice=False,
    )

    assert "User message: What is the weather?" in content
    assert "Answer Using a tool from the available tools" not in content
