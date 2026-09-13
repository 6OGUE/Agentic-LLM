import re
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from ddgs import DDGS


def normalize_words(text: str) -> list[str]:

    return re.findall(r"[a-z0-9]+", text.lower())


def score_url(query: str, url: str) -> int:
  

    query_words = set(normalize_words(query))

    parsed = urlparse(url)

    url_text = f"{parsed.netloc} {parsed.path}"

    url_words = set(normalize_words(url_text))

    return len(query_words.intersection(url_words))


def extract_main_content(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")

    for element in soup(
        [
            "script",
            "style",
            "noscript",
            "svg",
            "nav",
            "footer",
            "header",
            "form",
            "aside",
            "iframe",
            "button",
        ]
    ):
        element.decompose()

    candidates = []

    for selector in [
        "article",
        "main",
        "[role='main']",
    ]:
        for element in soup.select(selector):
            text = element.get_text(" ", strip=True)

            if len(text) > 200:
                candidates.append(element)

    content_selectors = [
        ".article-content",
        ".article-body",
        ".post-content",
        ".post-body",
        ".entry-content",
        ".entry-body",
        ".story-body",
        ".story-content",
        ".article__content",
        ".article__body",
        ".post__content",
        ".post__body",
        ".content-body",
        ".main-content",
        "#article-body",
        "#article-content",
        "#main-content",
    ]

    for selector in content_selectors:
        for element in soup.select(selector):
            text = element.get_text(" ", strip=True)

            if len(text) > 200:
                candidates.append(element)
    if candidates:
        best = max(
            candidates,
            key=lambda element: len(
                element.get_text(" ", strip=True)
            ),
        )

        content = best.get_text(
            "\n",
            strip=True,
        )

    else:
        paragraphs = []

        for paragraph in soup.find_all("p"):
            text = paragraph.get_text(" ", strip=True)

            if len(text) >= 40:
                paragraphs.append(text)

        content = "\n\n".join(paragraphs)

    lines = []

    for line in content.splitlines():
        line = " ".join(line.split())

        if line:
            lines.append(line)

    return "\n".join(lines)


def search_the_internet(query: str) -> str:
    if not query:
        return ""

    try:
        results = list(
            DDGS().text(
                query,
                region="in-en",
                safesearch="moderate",
                max_results=10,
            )
        )

        if not results:
            return ""

        scored_results = []

        for result in results:
            url = result.get("href")

            if not url:
                continue

            score = score_url(query, url)
            scored_results.append({"result": result, "score": score})

        if not scored_results:
            return ""

        best = max(scored_results, key=lambda item: item["score"])
        selected_result = best["result"]
        url = selected_result.get("href")

        response = requests.get(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/131.0.0.0 Safari/537.36"
                )
            },
            timeout=20,
        )

        response.raise_for_status()
        return extract_main_content(response.text)

    except (requests.RequestException, Exception):
        return ""