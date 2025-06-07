describe('Simple Test', () => {
  it('should pass basic arithmetic', () => {
    expect(2 + 2).toBe(4);
  });

  it('should work with async/await', async () => {
    const result = await Promise.resolve('hello');
    expect(result).toBe('hello');
  });
});