-- Migration: Create Community Schema (Feed, Connections, Chat)

-- 1. community_posts
CREATE TABLE IF NOT EXISTS public.community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. community_post_likes
CREATE TABLE IF NOT EXISTS public.community_post_likes (
    post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (post_id, user_id)
);

-- 3. community_comments
CREATE TABLE IF NOT EXISTS public.community_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. community_connections
CREATE TABLE IF NOT EXISTS public.community_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'BLOCKED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (requester_id, addressee_id)
);

-- 5. community_chat_rooms
CREATE TABLE IF NOT EXISTS public.community_chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (user1_id, user2_id)
);

-- 6. community_chat_messages
CREATE TABLE IF NOT EXISTS public.community_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.community_chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_chat_messages ENABLE ROW LEVEL SECURITY;

-- Posts Policies
CREATE POLICY "Everyone can view posts" ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert posts" ON public.community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.community_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.community_posts FOR DELETE USING (auth.uid() = user_id);

-- Likes Policies
CREATE POLICY "Everyone can view likes" ON public.community_post_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert own likes" ON public.community_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON public.community_post_likes FOR DELETE USING (auth.uid() = user_id);

-- Comments Policies
CREATE POLICY "Everyone can view comments" ON public.community_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON public.community_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.community_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.community_comments FOR DELETE USING (auth.uid() = user_id);

-- Connections Policies
CREATE POLICY "Users can view their connections" ON public.community_connections FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Users can request connection" ON public.community_connections FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Addressee can update connection status" ON public.community_connections FOR UPDATE USING (auth.uid() = addressee_id OR auth.uid() = requester_id);
CREATE POLICY "Users can delete their connections" ON public.community_connections FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Chat Rooms Policies
CREATE POLICY "Users can view their chat rooms" ON public.community_chat_rooms FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can create chat rooms" ON public.community_chat_rooms FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Chat Messages Policies
CREATE POLICY "Users can view messages in their rooms" ON public.community_chat_messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.community_chat_rooms r 
        WHERE r.id = room_id AND (r.user1_id = auth.uid() OR r.user2_id = auth.uid())
    )
);
CREATE POLICY "Users can send messages to their rooms" ON public.community_chat_messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND 
    EXISTS (
        SELECT 1 FROM public.community_chat_rooms r 
        WHERE r.id = room_id AND (r.user1_id = auth.uid() OR r.user2_id = auth.uid())
    )
);
CREATE POLICY "Users can update (read) messages in their rooms" ON public.community_chat_messages FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.community_chat_rooms r 
        WHERE r.id = room_id AND (r.user1_id = auth.uid() OR r.user2_id = auth.uid())
    )
);

-- Enable Realtime for all tables
alter publication supabase_realtime add table public.community_posts;
alter publication supabase_realtime add table public.community_post_likes;
alter publication supabase_realtime add table public.community_comments;
alter publication supabase_realtime add table public.community_connections;
alter publication supabase_realtime add table public.community_chat_rooms;
alter publication supabase_realtime add table public.community_chat_messages;
