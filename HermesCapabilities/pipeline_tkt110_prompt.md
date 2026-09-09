import imaplib, os
M = imaplib.IMAP4_SSL("imap.gmail.com", 993)
M.login(os.environ["VPS_GMAIL_RECEPTION_IMAP_ADRESS"], os.environ["VPS_GMAIL_RECEPTION_IMAP_MDP"])
typ, boxes = M.list()
target = [b.decode() for b in boxes if "ia-traite" in b.decode()]
print("folder:", target)
if target:
    import re
    name = re.findall(r'"([^"]+)"', target[0])[-1]
    M.select(f'"{name}"')
    typ, data = M.uid("SEARCH", None, "ALL")
    uids = (data[0] or b"").split()
    print("dans label:", len(uids))
    for uid in uids:
        M.uid("COPY", uid, "INBOX")
        M.uid("STORE", uid, "+FLAGS.SILENT", "(\\Deleted)")
    M.expunge()
M.select("INBOX")
typ, data = M.uid("SEARCH", "X-GM-RAW", '"to:REDACTED_EMAIL -label:ia-traite"')
print("à retraiter:", len((data[0] or b"").split()))
M.logout()
