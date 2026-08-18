begin;

-- Only the token-validating quiz_super_lig_host_start wrapper may call this
-- internal function. Match the Galatasaray quiz privilege boundary.
revoke all on function public.quiz_super_lig_start_game(uuid)
from public, anon, authenticated;

commit;
