-- Create the app_users table
CREATE TABLE IF NOT EXISTS public.app_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the custom_links table
CREATE TABLE IF NOT EXISTS public.custom_links (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    owner VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_links ENABLE ROW LEVEL SECURITY;

-- Create policies for app_users table
DROP POLICY IF EXISTS "Users can view their own data" ON public.app_users;
CREATE POLICY "Users can view their own data" ON public.app_users
    FOR SELECT USING (email = current_user);

DROP POLICY IF EXISTS "Users can insert their own data" ON public.app_users;
CREATE POLICY "Users can insert their own data" ON public.app_users
    FOR INSERT WITH CHECK (true);

-- Create policies for custom_links table
DROP POLICY IF EXISTS "Anyone can view custom links" ON public.custom_links;
CREATE POLICY "Anyone can view custom links" ON public.custom_links
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own links" ON public.custom_links;
CREATE POLICY "Users can insert their own links" ON public.custom_links
    FOR INSERT WITH CHECK (owner = current_user);

DROP POLICY IF EXISTS "Users can update their own links" ON public.custom_links;
CREATE POLICY "Users can update their own links" ON public.custom_links
    FOR UPDATE USING (owner = current_user);

DROP POLICY IF EXISTS "Users can delete their own links" ON public.custom_links;
CREATE POLICY "Users can delete their own links" ON public.custom_links
    FOR DELETE USING (owner = current_user);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_custom_links_category ON public.custom_links(category);
CREATE INDEX IF NOT EXISTS idx_custom_links_owner ON public.custom_links(owner);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.app_users(email);
