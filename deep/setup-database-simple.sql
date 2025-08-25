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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_custom_links_category ON public.custom_links(category);
CREATE INDEX IF NOT EXISTS idx_custom_links_owner ON public.custom_links(owner);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.app_users(email);
