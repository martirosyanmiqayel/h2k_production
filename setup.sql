-- H2K Production - Supabase Setup
-- Run this in your Supabase SQL editor

create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  category text not null,
  images text[],
  top_rated boolean default false,
  created_at timestamp default now()
);

-- RLS
alter table products enable row level security;
create policy "Public read" on products for select using (true);

-- Seed data
insert into products (name, description, category, images, top_rated) values
('ARRI SkyPanel S60-C', 'Professional LED softlight with full color control', 'lights', array['https://picsum.photos/seed/light1/600/400','https://picsum.photos/seed/light2/600/400','https://picsum.photos/seed/light3/600/400'], true),
('Sony FX9 Cinema Camera', 'Full-frame 6K cinema camera', 'camera', array['https://picsum.photos/seed/cam1/600/400','https://picsum.photos/seed/cam2/600/400','https://picsum.photos/seed/cam3/600/400'], true),
('Sennheiser MKH 416', 'Professional shotgun microphone', 'voice', array['https://picsum.photos/seed/mic1/600/400','https://picsum.photos/seed/mic2/600/400','https://picsum.photos/seed/mic3/600/400'], false),
('Aputure 600D Pro', 'Daylight-balanced LED spotlight 600W', 'lights', array['https://picsum.photos/seed/light4/600/400','https://picsum.photos/seed/light5/600/400','https://picsum.photos/seed/light6/600/400'], true),
('Canon EF 85mm f/1.4', 'Professional portrait lens', 'lenses', array['https://picsum.photos/seed/lens1/600/400','https://picsum.photos/seed/lens2/600/400','https://picsum.photos/seed/lens3/600/400'], false),
('Rode NTG5 Shotgun Mic', 'Lightweight broadcast shotgun microphone', 'voice', array['https://picsum.photos/seed/mic4/600/400','https://picsum.photos/seed/mic5/600/400','https://picsum.photos/seed/mic6/600/400'], false),
('Chimera Softbox Kit', 'Professional light diffusion kit', 'light-accessories', array['https://picsum.photos/seed/acc1/600/400','https://picsum.photos/seed/acc2/600/400','https://picsum.photos/seed/acc3/600/400'], false),
('Sony FE 24-70mm GM II', 'G Master standard zoom lens', 'lenses', array['https://picsum.photos/seed/lens4/600/400','https://picsum.photos/seed/lens5/600/400','https://picsum.photos/seed/lens6/600/400'], true),
('RED KOMODO 6K', 'Compact cinema camera 6K', 'camera', array['https://picsum.photos/seed/cam4/600/400','https://picsum.photos/seed/cam5/600/400','https://picsum.photos/seed/cam6/600/400'], true),
('Mercedes Sprinter Cargo Van', 'Fully equipped production cargo van', 'cargovan', array['https://picsum.photos/seed/van1/600/400','https://picsum.photos/seed/van2/600/400','https://picsum.photos/seed/van3/600/400'], true),
('Godox AD600 Pro', 'Witstro all-in-one outdoor flash', 'lights', array['https://picsum.photos/seed/light7/600/400','https://picsum.photos/seed/light8/600/400','https://picsum.photos/seed/light9/600/400'], false),
('Blackmagic URSA Mini Pro', '12K professional cinema camera', 'camera', array['https://picsum.photos/seed/cam7/600/400','https://picsum.photos/seed/cam8/600/400','https://picsum.photos/seed/cam9/600/400'], false),
('DJI Focus Pro', 'Wireless follow focus system', 'light-accessories', array['https://picsum.photos/seed/acc4/600/400','https://picsum.photos/seed/acc5/600/400','https://picsum.photos/seed/acc6/600/400'], false),
('Zeiss Milvus 50mm f/1.4', 'Premium standard prime lens', 'lenses', array['https://picsum.photos/seed/lens7/600/400','https://picsum.photos/seed/lens8/600/400','https://picsum.photos/seed/lens9/600/400'], false),
('Ford Transit Production Van', 'Custom outfitted production vehicle', 'cargovan', array['https://picsum.photos/seed/van4/600/400','https://picsum.photos/seed/van5/600/400','https://picsum.photos/seed/van6/600/400'], false);
