export interface ExtractedContent {
  url: string;
  title: string | null;
  text: string;
  contentHash: string;
}

export interface ContentExtractorProvider {
  readonly name: string;
  extract(url: string): Promise<ExtractedContent>;
}
