-- Create suggestions table
CREATE TABLE IF NOT EXISTS public.suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'under_review',
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_anonymous BOOLEAN DEFAULT false,
    admin_response_public TEXT,
    admin_response_private TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create suggestion_votes table
CREATE TABLE IF NOT EXISTS public.suggestion_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    suggestion_id UUID REFERENCES public.suggestions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('like', 'star')),
    star_value INTEGER CHECK (star_value >= 1 AND star_value <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(suggestion_id, user_id, type)
);

-- Create suggestion_comments table
CREATE TABLE IF NOT EXISTS public.suggestion_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    suggestion_id UUID REFERENCES public.suggestions(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_admin_response BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suggestions

-- Everyone authenticated can view suggestions
CREATE POLICY "Everyone authenticated can view suggestions"
    ON public.suggestions FOR SELECT
    TO authenticated
    USING (true);

-- Authenticated users can insert suggestions
CREATE POLICY "Authenticated users can insert suggestions"
    ON public.suggestions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);

-- Authors can update their own suggestions (only title, desc, category, etc.)
CREATE POLICY "Authors can update their own suggestions"
    ON public.suggestions FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

-- Admins can do anything on suggestions
CREATE POLICY "Admins can manage suggestions"
    ON public.suggestions FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.is_super_admin = true
      )
    );

-- RLS Policies for suggestion_votes

-- Everyone authenticated can view votes
CREATE POLICY "Everyone authenticated can view suggestion votes"
    ON public.suggestion_votes FOR SELECT
    TO authenticated
    USING (true);

-- Authenticated users can insert their own votes
CREATE POLICY "Authenticated users can insert their own votes"
    ON public.suggestion_votes FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Authenticated users can update their own votes
CREATE POLICY "Authenticated users can update their own votes"
    ON public.suggestion_votes FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Authenticated users can delete their own votes
CREATE POLICY "Authenticated users can delete their own votes"
    ON public.suggestion_votes FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Admins can do anything on votes
CREATE POLICY "Admins can manage suggestion votes"
    ON public.suggestion_votes FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.is_super_admin = true
      )
    );

-- RLS Policies for suggestion_comments

-- Everyone authenticated can view comments
CREATE POLICY "Everyone authenticated can view suggestion comments"
    ON public.suggestion_comments FOR SELECT
    TO authenticated
    USING (true);

-- Authenticated users can insert comments
CREATE POLICY "Authenticated users can insert suggestion comments"
    ON public.suggestion_comments FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);

-- Authors can update their own comments
CREATE POLICY "Authors can update their own comments"
    ON public.suggestion_comments FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

-- Authors can delete their own comments
CREATE POLICY "Authors can delete their own comments"
    ON public.suggestion_comments FOR DELETE
    TO authenticated
    USING (auth.uid() = author_id);

-- Admins can do anything on comments
CREATE POLICY "Admins can manage suggestion comments"
    ON public.suggestion_comments FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.is_super_admin = true
      )
    );
