INSERT INTO storage.buckets (id, name, public) 
VALUES ('cli_downloads', 'cli_downloads', true) 
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Downloads are publicly accessible." 
ON storage.objects FOR SELECT 
USING (bucket_id = 'cli_downloads');

CREATE POLICY "Admins can upload files." 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'cli_downloads');

CREATE POLICY "Admins can update files." 
ON storage.objects FOR UPDATE
USING (bucket_id = 'cli_downloads');

CREATE POLICY "Admins can delete files." 
ON storage.objects FOR DELETE
USING (bucket_id = 'cli_downloads');
