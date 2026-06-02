-- Retire pre-request chains: the JS/Chain chooser was removed, so a request can no
-- longer create, view, edit, or remove a pre-request chain. Clear every stored
-- binding so no chain executes invisibly before a request.
UPDATE requests SET pre_request_chain_id = NULL WHERE pre_request_chain_id IS NOT NULL;
