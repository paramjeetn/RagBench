# Python Best Practices

## PEP 8 Style Guide

PEP 8 is the official style guide for Python code. Its purpose is to improve the readability and consistency of Python code across the community. Key conventions include:

- **Indentation**: Use 4 spaces per indentation level. Never mix tabs and spaces.
- **Line length**: Limit lines to 79 characters for code and 72 for docstrings/comments.
- **Naming conventions**: Use `snake_case` for functions and variables, `PascalCase` for classes, and `UPPER_CASE` for constants. Leading underscores indicate internal use (`_private_var`), and double leading underscores trigger name mangling (`__mangled`).
- **Imports**: Place imports at the top of the file. Order them as: standard library, third-party packages, local modules, each group separated by a blank line. Avoid wildcard imports (`from module import *`).
- **Whitespace**: Avoid extraneous whitespace in brackets, before commas, and around assignment operators in keyword arguments.

Tools like `black` (auto-formatter), `flake8` (linter), and `ruff` (fast linter + formatter) enforce PEP 8 compliance automatically.

## Type Hints

Type hints (introduced in PEP 484) provide optional static type annotations for Python code. They enable better IDE support, catch bugs before runtime, and serve as documentation.

```python
def calculate_average(numbers: list[float]) -> float:
    return sum(numbers) / len(numbers)
```

Key type hint features include:
- **Built-in generics** (Python 3.9+): `list[int]`, `dict[str, float]`, `tuple[int, str]`
- **Optional types**: `str | None` (Python 3.10+) or `Optional[str]`
- **TypeVar and Generics**: For creating generic functions and classes
- **Protocol**: Structural subtyping for duck typing with type safety

Use `mypy` or `pyright` as static type checkers to verify type correctness without running the code. Type hints have zero runtime overhead when not explicitly introspected.

## Virtual Environments

Virtual environments create isolated Python installations that prevent dependency conflicts between projects. Each project should have its own virtual environment.

**Creating and using virtual environments**:
- `python -m venv .venv` — creates a new virtual environment in the `.venv` directory
- `source .venv/bin/activate` (Unix) or `.venv\Scripts\activate` (Windows) — activates the environment
- `pip install -r requirements.txt` — installs project dependencies
- `pip freeze > requirements.txt` — captures current dependencies

**Modern alternatives**:
- **Poetry**: Manages dependencies, virtual environments, and packaging in one tool. Uses `pyproject.toml` for configuration.
- **uv**: An extremely fast Python package manager written in Rust. Drop-in replacement for pip and venv with 10-100x speed improvements.
- **conda**: Popular in data science for managing both Python packages and system-level dependencies.

Always pin dependency versions in production (`requests==2.31.0`) to ensure reproducible builds. Use version ranges in libraries (`requests>=2.25,<3.0`) to allow flexibility.

## Testing

Testing is essential for maintaining code quality and catching regressions. Python's testing ecosystem includes:

**pytest**: The de facto standard testing framework. Features include automatic test discovery, powerful assertion introspection, fixtures for setup/teardown, parametrize for running tests with multiple inputs, and a rich plugin ecosystem.

```python
import pytest

def test_average_normal():
    assert calculate_average([1.0, 2.0, 3.0]) == 2.0

def test_average_single():
    assert calculate_average([5.0]) == 5.0

@pytest.mark.parametrize("input,expected", [
    ([1, 2, 3], 2.0),
    ([10, 20], 15.0),
])
def test_average_parametrized(input, expected):
    assert calculate_average(input) == expected
```

**Testing best practices**:
- Follow the Arrange-Act-Assert pattern: set up test data, perform the action, verify the result.
- Test edge cases: empty inputs, boundary values, error conditions.
- Use fixtures for shared setup code instead of duplicating it across tests.
- Aim for high test coverage but prioritize testing critical paths and complex logic over trivial code.
- Use mocking sparingly — prefer integration tests with real dependencies when practical, as mocked tests can pass while production fails.

## Error Handling

Python uses exceptions for error handling. Best practices include:

- **Be specific**: Catch specific exceptions rather than bare `except:` or `except Exception`. This prevents accidentally swallowing unexpected errors.
- **EAFP over LBYL**: Python favors "Easier to Ask Forgiveness than Permission" — try the operation and handle the exception, rather than checking conditions beforehand.
- **Custom exceptions**: Create domain-specific exception classes that inherit from `Exception` for your application's error types.
- **Context managers**: Use `with` statements for resource management (files, database connections, locks) to ensure proper cleanup even when exceptions occur.
- **Logging**: Use the `logging` module instead of `print()` for error reporting. Configure appropriate log levels (DEBUG, INFO, WARNING, ERROR, CRITICAL).

## Project Structure

A well-organized Python project follows a standard layout:

```
my_project/
├── src/my_project/     # Source code package
│   ├── __init__.py
│   ├── core.py
│   └── utils.py
├── tests/              # Test directory mirrors src structure
│   ├── test_core.py
│   └── test_utils.py
├── pyproject.toml      # Project metadata and build config
├── requirements.txt    # Pinned dependencies
├── .gitignore
└── README.md
```

Use `pyproject.toml` (PEP 621) as the single source for project metadata, dependencies, and tool configuration. This replaces the older `setup.py` and `setup.cfg` approach.
