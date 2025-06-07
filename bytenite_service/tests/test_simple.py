import pytest


def test_basic_arithmetic():
    """Test basic arithmetic operations"""
    assert 2 + 2 == 4
    assert 3 * 3 == 9


@pytest.mark.asyncio
async def test_async_functionality():
    """Test async functionality works"""
    result = await async_function()
    assert result == "hello async"


async def async_function():
    """Simple async function for testing"""
    return "hello async"