"""Document parsing module for the RAG Eval System.

Supports PDF, Markdown, plain text, and HTML documents.
"""

from __future__ import annotations

import io
import os
from dataclasses import dataclass, field

from bs4 import BeautifulSoup
import markdown
from PyPDF2 import PdfReader


@dataclass
class ParsedDocument:
    """Container for a parsed document and its metadata."""

    text: str
    filename: str
    file_type: str  # pdf, markdown, txt, html
    metadata: dict = field(default_factory=dict)  # page_count, etc.


# ---------------------------------------------------------------------------
# Individual parsers
# ---------------------------------------------------------------------------


def parse_pdf(content: bytes, filename: str) -> ParsedDocument:
    """Parse a PDF file from raw bytes.

    Extracts text page-by-page using PyPDF2. Stores ``page_count`` in
    metadata.  Returns an empty-text document for PDFs with no extractable
    text.
    """
    reader = PdfReader(io.BytesIO(content))
    pages: list[str] = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            pages.append(page_text)

    return ParsedDocument(
        text="\n\n".join(pages),
        filename=filename,
        file_type="pdf",
        metadata={"page_count": len(reader.pages)},
    )


def parse_markdown(content: bytes, filename: str) -> ParsedDocument:
    """Parse a Markdown file from raw bytes.

    Converts Markdown to HTML via the ``markdown`` library and then strips
    tags with BeautifulSoup to produce plain text.  The original raw
    Markdown source is preserved in ``metadata["raw_markdown"]``.
    """
    raw_md = content.decode("utf-8")
    html = markdown.markdown(raw_md)
    soup = BeautifulSoup(html, "html.parser")
    plain_text = soup.get_text(separator="\n")

    return ParsedDocument(
        text=plain_text,
        filename=filename,
        file_type="markdown",
        metadata={"raw_markdown": raw_md},
    )


def parse_txt(content: bytes, filename: str) -> ParsedDocument:
    """Parse a plain-text file from raw bytes."""
    text = content.decode("utf-8")
    return ParsedDocument(
        text=text,
        filename=filename,
        file_type="txt",
        metadata={},
    )


def parse_html(content: bytes, filename: str) -> ParsedDocument:
    """Parse an HTML file from raw bytes.

    Uses BeautifulSoup to extract visible text content, stripping all tags.
    """
    raw_html = content.decode("utf-8")
    soup = BeautifulSoup(raw_html, "html.parser")

    # Remove script and style elements before extracting text.
    for element in soup(["script", "style"]):
        element.decompose()

    text = soup.get_text(separator="\n")
    # Collapse excessive blank lines.
    lines = [line.strip() for line in text.splitlines()]
    text = "\n".join(line for line in lines if line)

    return ParsedDocument(
        text=text,
        filename=filename,
        file_type="html",
        metadata={},
    )


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

_EXTENSION_MAP: dict[str, callable] = {
    ".pdf": parse_pdf,
    ".md": parse_markdown,
    ".txt": parse_txt,
    ".html": parse_html,
    ".htm": parse_html,
}


def parse_document(content: bytes, filename: str) -> ParsedDocument:
    """Dispatch to the appropriate parser based on the file extension.

    Raises ``ValueError`` for unsupported file types.
    """
    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    parser_fn = _EXTENSION_MAP.get(ext)
    if parser_fn is None:
        supported = ", ".join(sorted(_EXTENSION_MAP.keys()))
        raise ValueError(
            f"Unsupported file type '{ext}' for file '{filename}'. "
            f"Supported extensions: {supported}"
        )

    return parser_fn(content, filename)
