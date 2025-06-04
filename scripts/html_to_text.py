#!/usr/bin/env python3
"""
HTML to Text Converter for KonvaJS Documentation

This script converts the scraped HTML documentation files to clean,
human-readable plain text format.
"""

import os
import re
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString
import html

class HTMLToTextConverter:
    def __init__(self, input_dir="preprocessing_tilemap/external_context/konva_docs/html", output_dir="preprocessing_tilemap/external_context/konva_docs_text"):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
    def clean_text(self, text):
        """Clean and format text content"""
        if not text:
            return ""
        
        # Decode HTML entities
        text = html.unescape(text)
        
        # Replace multiple whitespace with single space
        text = re.sub(r'\s+', ' ', text)
        
        # Strip leading/trailing whitespace
        text = text.strip()
        
        return text
    
    def extract_text_with_formatting(self, element, indent_level=0):
        """Extract text with basic formatting preserved"""
        if not element:
            return ""
        
        result = []
        indent = "  " * indent_level
        
        # Handle different HTML elements
        if element.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            level = int(element.name[1])
            prefix = "#" * level + " "
            text = self.clean_text(element.get_text())
            if text:
                result.append(f"\n{prefix}{text}\n")
        
        elif element.name == 'p':
            text = self.clean_text(element.get_text())
            if text:
                result.append(f"\n{text}\n")
        
        elif element.name in ['ul', 'ol']:
            result.append("\n")
            for i, li in enumerate(element.find_all('li', recursive=False)):
                text = self.clean_text(li.get_text())
                if text:
                    prefix = f"{i+1}. " if element.name == 'ol' else "• "
                    result.append(f"{indent}{prefix}{text}\n")
            result.append("\n")
        
        elif element.name == 'li':
            # Skip if we're processing it as part of ul/ol
            pass
        
        elif element.name == 'pre':
            # Code blocks
            code_text = element.get_text()
            if code_text.strip():
                result.append(f"\n```\n{code_text.rstrip()}\n```\n")
        
        elif element.name == 'code' and element.parent.name != 'pre':
            # Inline code
            text = self.clean_text(element.get_text())
            if text:
                result.append(f"`{text}`")
        
        elif element.name == 'blockquote':
            text = self.clean_text(element.get_text())
            if text:
                # Split into lines and prefix each with >
                lines = text.split('\n')
                quoted = '\n'.join(f"> {line}" for line in lines if line.strip())
                result.append(f"\n{quoted}\n")
        
        elif element.name == 'a':
            text = self.clean_text(element.get_text())
            href = element.get('href', '')
            if text and href:
                result.append(f"{text} ({href})")
            elif text:
                result.append(text)
        
        elif element.name in ['div', 'section', 'article', 'main']:
            # Process children for container elements
            for child in element.children:
                if isinstance(child, NavigableString):
                    text = self.clean_text(str(child))
                    if text:
                        result.append(text)
                else:
                    result.append(self.extract_text_with_formatting(child, indent_level))
        
        elif element.name in ['br']:
            result.append("\n")
        
        elif element.name in ['strong', 'b']:
            text = self.clean_text(element.get_text())
            if text:
                result.append(f"**{text}**")
        
        elif element.name in ['em', 'i']:
            text = self.clean_text(element.get_text())
            if text:
                result.append(f"*{text}*")
        
        elif element.name in ['table']:
            result.append("\n[TABLE CONTENT]\n")
            for row in element.find_all('tr'):
                cells = [self.clean_text(cell.get_text()) for cell in row.find_all(['td', 'th'])]
                if any(cells):
                    result.append("| " + " | ".join(cells) + " |\n")
            result.append("\n")
        
        else:
            # For other elements, just extract text
            text = self.clean_text(element.get_text())
            if text:
                result.append(text)
        
        return "".join(result)
    
    def convert_html_file(self, html_file_path):
        """Convert a single HTML file to text"""
        try:
            with open(html_file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            soup = BeautifulSoup(content, 'html.parser')
            
            # Extract title
            title_elem = soup.find('title')
            title = title_elem.get_text() if title_elem else "Untitled"
            
            # Extract source URL
            source_elem = soup.find('div', class_='source-url')
            source_url = ""
            if source_elem:
                link = source_elem.find('a')
                if link:
                    source_url = link.get('href', '')
            
            # Find main content (should be everything after the source-url div)
            main_content = soup.find('body')
            if main_content:
                # Remove the source-url div
                source_div = main_content.find('div', class_='source-url')
                if source_div:
                    source_div.decompose()
            
            # Extract and format text
            if main_content:
                text_content = self.extract_text_with_formatting(main_content)
            else:
                text_content = soup.get_text()
            
            # Clean up the text
            text_content = re.sub(r'\n\s*\n\s*\n', '\n\n', text_content)  # Remove excessive blank lines
            text_content = text_content.strip()
            
            # Create header
            header = f"{title}\n{'=' * len(title)}\n\n"
            if source_url:
                header += f"Source: {source_url}\n\n"
            
            final_content = header + text_content
            
            return final_content
            
        except Exception as e:
            print(f"Error converting {html_file_path}: {e}")
            return None
    
    def convert_all_files(self):
        """Convert all HTML files in the input directory"""
        html_files = list(self.input_dir.glob("*.html"))
        
        if not html_files:
            print(f"No HTML files found in {self.input_dir}")
            return
        
        print(f"Found {len(html_files)} HTML files to convert")
        print(f"Output directory: {self.output_dir.absolute()}")
        
        converted_count = 0
        
        for html_file in html_files:
            if html_file.name == 'index.html':
                continue  # Skip index file
            
            print(f"Converting: {html_file.name}")
            
            text_content = self.convert_html_file(html_file)
            
            if text_content:
                # Create output filename
                text_filename = html_file.stem + ".txt"
                output_path = self.output_dir / text_filename
                
                # Save text file
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(text_content)
                
                print(f"Saved: {output_path}")
                converted_count += 1
            else:
                print(f"Failed to convert: {html_file.name}")
        
        # Create a combined file with all documentation
        self.create_combined_file(html_files)
        
        print(f"\nConversion complete! Converted {converted_count} files.")
        print(f"Text files saved to: {self.output_dir.absolute()}")
    
    def create_combined_file(self, html_files):
        """Create a single combined text file with all documentation"""
        combined_content = []
        combined_content.append("KonvaJS Documentation - Complete Reference\n")
        combined_content.append("=" * 50 + "\n\n")
        
        for html_file in sorted(html_files):
            if html_file.name == 'index.html':
                continue
            
            text_content = self.convert_html_file(html_file)
            if text_content:
                combined_content.append(text_content)
                combined_content.append("\n" + "=" * 80 + "\n\n")
        
        combined_path = self.output_dir / "konvajs_complete_docs.txt"
        with open(combined_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(combined_content))
        
        print(f"Created combined documentation: {combined_path}")


def main():
    """Main function to run the converter"""
    converter = HTMLToTextConverter()
    converter.convert_all_files()


if __name__ == "__main__":
    main() 