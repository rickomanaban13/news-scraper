const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Function to convert any URL to absolute
const makeUrlAbsolute = (baseUrl, relativeUrl) => {
  try {
    // If the URL is already absolute, return it
    if (relativeUrl.match(/^(http|https):\/\//)) {
      return relativeUrl;
    }

    // Handle protocol-relative URLs (starting with //)
    if (relativeUrl.startsWith('//')) {
      return `${new URL(baseUrl).protocol}${relativeUrl}`;
    }

    // Handle root-relative URLs (starting with single /)
    if (relativeUrl.startsWith('/')) {
      const url = new URL(baseUrl);
      return `${url.protocol}//${url.host}${relativeUrl}`;
    }

    // Handle relative URLs without leading slash
    return new URL(relativeUrl, baseUrl).toString();
  } catch (error) {
    console.error('Error converting URL:', error);
    return baseUrl; // Return base URL if conversion fails
  }
};

// Function to extract href from various attribute formats
const extractHref = ($element) => {
  // Common attributes that might contain URLs
  const urlAttributes = ['href', 'data-href', 'data-url', 'data-link'];
  
  for (const attr of urlAttributes) {
    const value = $element.attr(attr);
    if (value && value.trim() !== '#' && !value.startsWith('javascript:')) {
      return value.trim();
    }
  }
  
  return null;
};

app.post('/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    
    // Check if URL is provided
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log('Attempting to scrape URL:', url);

    // Fetch the webpage content
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      maxRedirects: 5, // Handle redirects
      validateStatus: (status) => status < 400 // Accept all successful responses
    });

    const $ = cheerio.load(response.data);
    const articles = [];
    const processedLinks = new Set(); // Track processed links to avoid duplicates

    // Log the HTML content for debugging
    console.log('HTML content received:', response.data.substring(0, 500) + '...');

    // Try different common selectors for news articles
    const selectors = [
      'article',
      '.article',
      '.post',
      '.news-item',
      '.story',
      '.entry',
      '.item',
      // Add more selectors based on the website structure
      'div[class*="article"]',
      'div[class*="post"]',
      'div[class*="news"]'
    ];

    selectors.forEach(selector => {
      $(selector).each((i, element) => {
        const $element = $(element);
        
        // Try different selectors for headline
        const headline = $element.find('h1, h2, h3, .title, [class*="title"], [class*="headline"]').first().text().trim();
        
        // Try different selectors for author
        const author = $element.find('.author, .byline, [class*="author"], [class*="byline"]').first().text().trim();
        
        // Try different selectors for date
        const date = $element.find('.date, .published, time, [class*="date"], [class*="time"]').first().text().trim();
        
        // Enhanced link extraction
        let link = null;
        
        // Try different methods to find the link
        const linkSelectors = [
          'a[href]', // Regular links
          '[class*="link"][href]', // Links with 'link' in class
          '[data-href]', // Custom data attributes
          '[data-url]',
          '[data-link]'
        ];

        for (const linkSelector of linkSelectors) {
          const $link = $element.find(linkSelector).first();
          if ($link.length) {
            const href = extractHref($link);
            if (href) {
              link = href;
              break;
            }
          }
        }

        // If no link found in child elements, check the element itself
        if (!link) {
          link = extractHref($element);
        }

        // Convert link to absolute URL
        if (link) {
          link = makeUrlAbsolute(url, link);
        } else {
          link = url; // Fallback to main URL if no specific link found
        }

        // Skip if we've already processed this link or headline
        if (processedLinks.has(link) || articles.some(a => a.headline === headline)) {
          return;
        }

        if (headline && headline.length > 0) {
          processedLinks.add(link);
          articles.push({
            headline,
            author: author || 'Unknown',
            date: date || 'Not available',
            source: new URL(url).hostname,
            link,
            originalLink: link // Store the original link for reference
          });
        }
      });
    });

    console.log(`Found ${articles.length} articles`);
    
    if (articles.length === 0) {
      console.log('No articles found. HTML structure might be different.');
      return res.status(404).json({ 
        error: 'No articles found',
        message: 'The scraper could not find any articles. The website structure might be different than expected.'
      });
    }

    res.json({ articles });
  } catch (error) {
    console.error('Scraping error:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to scrape the website',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 