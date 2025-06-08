#!/usr/bin/env python3
"""
KonvaJS Documentation Scraper

This script uses browser MCP tools to scrape the KonvaJS documentation
by navigating through all pages in the docs sidebar and extracting 
article content.
"""

import time
import json
import os
from pathlib import Path
from bs4 import BeautifulSoup
import requests
from urllib.parse import urljoin, urlparse
import re

class KonvaJSDocScraper:
    def __init__(self, base_url="https://konvajs.org/docs/", output_dir="konva_docs"):
        self.base_url = base_url
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.scraped_urls = set()
        self.doc_links = []
        
    def sanitize_filename(self, text):
        """Convert URL or title to safe filename"""
        # Remove or replace problematic characters
        text = re.sub(r'[^\w\s-]', '', text)
        text = re.sub(r'[-\s]+', '-', text)
        return text.strip('-').lower()
    
    def extract_sidebar_links(self, html_content):
        """Extract all documentation links from the sidebar"""
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Find the docs sidebar
        sidebar = soup.find('nav', {'aria-label': 'Docs sidebar'}) or \
                 soup.find('div', class_=lambda x: x and 'sidebar' in x.lower()) or \
                 soup.find('aside') or \
                 soup.select('[data-testid*="sidebar"]')
        
        if not sidebar:
            print("Warning: Could not find docs sidebar")
            # Fallback: look for all links that seem like docs
            links = soup.find_all('a', href=lambda x: x and '/docs/' in x)
        else:
            links = sidebar.find_all('a', href=True)
        
        doc_links = []
        for link in links:
            href = link.get('href')
            if href:
                # Convert relative URLs to absolute
                if href.startswith('/'):
                    full_url = urljoin(self.base_url, href)
                elif href.startswith('#'):
                    continue  # Skip anchor links
                elif not href.startswith('http'):
                    full_url = urljoin(self.base_url, href)
                else:
                    full_url = href
                
                # Only include docs URLs
                if '/docs/' in full_url:
                    title = link.get_text(strip=True)
                    doc_links.append({
                        'url': full_url,
                        'title': title,
                        'filename': self.sanitize_filename(title or href.split('/')[-1])
                    })
        
        return doc_links
    
    def extract_article_content(self, html_content, url):
        """Extract the main article content from a documentation page"""
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Try different selectors for the main content
        content_selectors = [
            'article',
            'main article',
            '.markdown',
            '.content',
            '.documentation-content',
            '[role="main"] article',
            'main .markdown',
            '.docs-content'
        ]
        
        article = None
        for selector in content_selectors:
            article = soup.select_one(selector)
            if article:
                break
        
        if not article:
            print(f"Warning: Could not find article content for {url}")
            # Fallback: try to find the main content area
            main = soup.find('main') or soup.find('div', class_=lambda x: x and 'main' in x.lower())
            if main:
                article = main
            else:
                return None
        
        # Clean up the content
        # Remove navigation elements, ads, etc.
        for elem in article.find_all(['nav', 'aside', 'header', 'footer']):
            elem.decompose()
        
        # Remove script and style tags
        for elem in article.find_all(['script', 'style']):
            elem.decompose()
        
        # Convert relative links to absolute
        for link in article.find_all('a', href=True):
            href = link['href']
            if href.startswith('/') or not href.startswith('http'):
                link['href'] = urljoin(url, href)
        
        # Convert relative image sources to absolute
        for img in article.find_all('img', src=True):
            src = img['src']
            if src.startswith('/') or not src.startswith('http'):
                img['src'] = urljoin(url, src)
        
        return str(article)
    
    def save_page_content(self, content, filename, title, url):
        """Save the extracted content to an HTML file"""
        html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - KonvaJS Documentation</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }}
        pre {{
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }}
        code {{
            background: #f0f0f0;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Monaco', 'Consolas', monospace;
        }}
        pre code {{
            background: none;
            padding: 0;
        }}
        .source-url {{
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 10px;
            margin: 20px 0;
            font-size: 0.9em;
        }}
    </style>
</head>
<body>
    <div class="source-url">
        <strong>Source:</strong> <a href="{url}" target="_blank">{url}</a>
    </div>
    {content}
</body>
</html>"""
        
        filepath = self.output_dir / f"{filename}.html"
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_template)
        
        print(f"Saved: {filepath}")
        return filepath
    
    def scrape_docs(self):
        """Main scraping function that coordinates the entire process"""
        print(f"Starting KonvaJS documentation scrape...")
        print(f"Output directory: {self.output_dir.absolute()}")
        
        # First, get the main docs page to extract sidebar links
        print(f"Fetching main docs page: {self.base_url}")
        
        try:
            response = requests.get(self.base_url, timeout=10)
            response.raise_for_status()
            main_page_content = response.text
        except Exception as e:
            print(f"Error fetching main page: {e}")
            return
        
        # Extract all documentation links
        self.doc_links = self.extract_sidebar_links(main_page_content)
        print(f"Found {len(self.doc_links)} documentation links")
        
        # Create index file
        self.create_index_file()
        
        # Scrape each documentation page
        for i, link_info in enumerate(self.doc_links, 1):
            url = link_info['url']
            title = link_info['title']
            filename = link_info['filename']
            
            if url in self.scraped_urls:
                print(f"Skipping already scraped: {url}")
                continue
            
            print(f"[{i}/{len(self.doc_links)}] Scraping: {title} ({url})")
            
            try:
                response = requests.get(url, timeout=10)
                response.raise_for_status()
                page_content = response.text
                
                article_content = self.extract_article_content(page_content, url)
                
                if article_content:
                    self.save_page_content(article_content, filename, title, url)
                    self.scraped_urls.add(url)
                else:
                    print(f"No content found for: {url}")
                
                # Be respectful - small delay between requests
                time.sleep(1)
                
            except Exception as e:
                print(f"Error scraping {url}: {e}")
                continue
        
        print(f"\nScraping complete! Scraped {len(self.scraped_urls)} pages.")
        print(f"Files saved to: {self.output_dir.absolute()}")
    
    def create_index_file(self):
        """Create an index HTML file with links to all scraped docs"""
        index_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KonvaJS Documentation - Local Archive</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #eee;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .doc-list {
            list-style: none;
            padding: 0;
        }
        .doc-list li {
            margin: 10px 0;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 5px;
            border-left: 4px solid #2196f3;
        }
        .doc-list a {
            text-decoration: none;
            color: #1976d2;
            font-weight: 500;
        }
        .doc-list a:hover {
            text-decoration: underline;
        }
        .meta {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>KonvaJS Documentation</h1>
        <p>Local archive of KonvaJS documentation</p>
    </div>
    
    <div class="meta">
        <strong>Source:</strong> <a href="https://konvajs.org/docs/" target="_blank">https://konvajs.org/docs/</a><br>
        <strong>Scraped:</strong> """ + time.strftime('%Y-%m-%d %H:%M:%S') + f"""<br>
        <strong>Total Pages:</strong> {len(self.doc_links)}
    </div>
    
    <h2>Documentation Pages</h2>
    <ul class="doc-list">
"""
        
        for link_info in self.doc_links:
            filename = link_info['filename']
            title = link_info['title']
            url = link_info['url']
            
            index_content += f"""        <li>
            <a href="{filename}.html">{title}</a>
            <br><small>Source: <a href="{url}" target="_blank">{url}</a></small>
        </li>
"""
        
        index_content += """    </ul>
</body>
</html>"""
        
        index_path = self.output_dir / "index.html"
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(index_content)
        
        print(f"Created index file: {index_path}")


def main():
    """Main function to run the scraper"""
    scraper = KonvaJSDocScraper()
    scraper.scrape_docs()


if __name__ == "__main__":
    main()

