class SearchAdapter {
  async search(query) {
    try {
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`
      );
      const data = await response.json();
      if (data.Abstract) return data.Abstract;
      const heading = data.Heading || '';
      const related = (data.RelatedTopics || []).slice(0, 3).map(t => t.Text).join(' | ');
      return (heading + ' ' + related).trim() || 'No results found.';
    } catch (err) {
      return `Search error: ${err.message}`;
    }
  }
}

module.exports = { SearchAdapter };
