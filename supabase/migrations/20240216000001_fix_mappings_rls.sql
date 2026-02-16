-- Allow anonymous inserts for MVP (In production, restrict to authenticated users)
CREATE POLICY "Enable insert for all users"
ON public.zap_mappings
FOR INSERT
TO public
WITH CHECK (true);

-- Allow anonymous updates
CREATE POLICY "Enable update for all users"
ON public.zap_mappings
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Allow anonymous deletes
CREATE POLICY "Enable delete for all users"
ON public.zap_mappings
FOR DELETE
TO public
USING (true);

-- Fix select policy just in case
DROP POLICY IF EXISTS "Authenticated users can view mappings" ON public.zap_mappings;
CREATE POLICY "Enable read access for all users"
ON public.zap_mappings
FOR SELECT
TO public
USING (true);
