from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import os
import re
import io
import pandas as pd
import requests
from requests.auth import HTTPBasicAuth

from jira import JIRA
from dotenv import load_dotenv

load_dotenv()

# Ensure credentials and tokens from the user's script are 
# stored securely in environment variables (e.g., .env file).
JIRA_SERVER = os.getenv("JIRA_SERVER", "https://your-domain.atlassian.net")
JIRA_EMAIL = os.getenv("JIRA_EMAIL")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")

if JIRA_EMAIL and JIRA_API_TOKEN:
    jira_client = JIRA(server=JIRA_SERVER, basic_auth=(JIRA_EMAIL, JIRA_API_TOKEN))
    print("Successfully connected to Jira.")
else:
    jira_client = None
    print("Warning: Missing JIRA_EMAIL or JIRA_API_TOKEN in environment variables. Jira calls will fail.")

STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="Jira Operations API")

# Allow CORS for the frontend HTML interface
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Serve Frontend Pages ---
@app.get("/")
async def serve_frontend():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.get("/styles.css")
async def serve_css():
    return FileResponse(os.path.join(STATIC_DIR, "styles.css"), media_type="text/css")

@app.get("/script.js")
async def serve_js():
    return FileResponse(os.path.join(STATIC_DIR, "script.js"), media_type="application/javascript")

# =============================================
# Helper functions (ported from user's script)
# =============================================

def get_fields_meta(project_key, issue_type_name):
    meta = jira_client.createmeta(
        projectKeys=project_key,
        issuetypeNames=issue_type_name,
        expand="projects.issuetypes.fields"
    )
    projects = meta.get("projects", [])
    if not projects:
        raise ValueError(f"No project metadata returned for {project_key}")
    issuetypes = projects[0].get("issuetypes", [])
    if not issuetypes:
        raise ValueError(f"No issue type metadata returned for {issue_type_name}")
    return issuetypes[0].get("fields", {})

def get_allowed_values(fields, field_id):
    return fields.get(field_id, {}).get("allowedValues", [])

def option_label(opt):
    if isinstance(opt, dict):
        return opt.get("value") or opt.get("name") or opt.get("displayName") or str(opt)
    return str(opt)

def find_option_object(options, wanted_value, field_name):
    if not options:
        raise ValueError(f"No options returned by Jira for field: {field_name}")
    for opt in options:
        if isinstance(opt, dict):
            for key in ("value", "name", "displayName"):
                val = opt.get(key)
                if val and str(val).strip().lower() == wanted_value.strip().lower():
                    if opt.get("id") is not None:
                        return {"id": str(opt["id"])}
                    if opt.get("value") is not None:
                        return {"value": opt["value"]}
                    if opt.get("name") is not None:
                        return {"name": opt["name"]}
        else:
            if str(opt).strip().lower() == wanted_value.strip().lower():
                return {"value": str(opt)}
    allowed = [option_label(opt) for opt in options]
    raise ValueError(f"Invalid value '{wanted_value}' for field '{field_name}'. Allowed values: {allowed}")

def find_component_object(component_options, component_name):
    if not component_options:
        raise ValueError("No component options returned by Jira")
    for comp in component_options:
        if isinstance(comp, dict):
            name = comp.get("name", "")
            if name.strip().lower() == component_name.strip().lower():
                return {"name": name}
    allowed = [comp.get("name") for comp in component_options if isinstance(comp, dict)]
    raise ValueError(f"Invalid component '{component_name}'. Allowed values: {allowed}")

def get_user_account_id(name_or_email):
    users = jira_client.search_users(query=name_or_email, maxResults=20)
    for user in users:
        display_name = getattr(user, "displayName", "") or ""
        email_address = getattr(user, "emailAddress", "") or ""
        if display_name.lower() == name_or_email.lower() or email_address.lower() == name_or_email.lower():
            return user.accountId
    if users:
        return users[0].accountId
    raise ValueError(f"User not found: {name_or_email}")

# =============================================
# API Endpoints
# =============================================

# --- Endpoint to fetch allowed values for form dropdowns ---
@app.get("/field-options/{issue_type}")
async def get_field_options(issue_type: str):
    """Fetch allowed values for all required custom fields from Jira metadata."""
    if not jira_client:
        raise HTTPException(status_code=500, detail="Jira client not configured.")
    try:
        fields = get_fields_meta("GRA", issue_type)
        
        def extract_labels(field_id):
            options = get_allowed_values(fields, field_id)
            return [option_label(opt) for opt in options]
        
        return {
            "department": extract_labels("customfield_10114"),
            "primaryClient": extract_labels("customfield_10112"),
            "endUserOS": extract_labels("customfield_10115"),
            "databaseType": extract_labels("customfield_10156"),
            "components": extract_labels("components"),
            "priority": extract_labels("priority"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sprints/{project_key}")
async def get_sprints(project_key: str):
    """Fetch active and future sprints for a project using Jira Agile API."""
    if not jira_client:
        raise HTTPException(status_code=500, detail="Jira client not configured.")
    try:
        auth = HTTPBasicAuth(JIRA_EMAIL, JIRA_API_TOKEN)
        headers = {"Accept": "application/json"}
        
        boards_url = f"{JIRA_SERVER}/rest/agile/1.0/board"
        boards_response = requests.get(
            boards_url,
            headers=headers,
            auth=auth,
            params={
                "projectKeyOrId": project_key,
                "type": "scrum"
            }
        )
        boards_response.raise_for_status()
        boards = boards_response.json().get("values", [])
        
        sprint_values = []
        for board in boards:
            board_id = board["id"]
            start_at = 0
            max_results = 50
            while True:
                sprint_url = f"{JIRA_SERVER}/rest/agile/1.0/board/{board_id}/sprint"
                sprint_response = requests.get(
                    sprint_url,
                    headers=headers,
                    auth=auth,
                    params={
                        "startAt": start_at,
                        "maxResults": max_results,
                        "state": "active,future" # we only want active/future for ticket creation
                    }
                )
                sprint_response.raise_for_status()
                data = sprint_response.json()
                
                for sprint in data.get("values", []):
                    sprint_values.append({
                        "id": sprint.get("id"),
                        "name": sprint.get("name"),
                        "state": sprint.get("state"),
                        "board": board.get("name")
                    })
                
                if data.get("isLast", True):
                    break
                start_at += max_results
                
        return {"status": "success", "sprints": sprint_values}
    except Exception as e:
        print(f"Error fetching sprints: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# --- Pydantic Models ---
class TicketCreateRequest(BaseModel):
    projectKey: str = "GRA"
    issueType: Optional[str] = "Task"
    summary: str
    description: str
    # GRA defaults
    assignee: str = "Khushi Mahajan"
    reporter: str = "Khushi Mahajan"
    department: str = "Functional"
    primaryClient: str = "Internal (ARCON)"
    component: str = "all"
    priority: str = "Low"
    endUserOS: str = "Windows"
    databaseType: str = "MySql & MSSql"
    # DEVOP fields
    product: Optional[str] = None

class TicketMoveRequest(BaseModel):
    ticketNumber: str
    targetStatus: str
    sourceStatus: Optional[str] = None


@app.post("/create-ticket")
async def create_ticket(
    projectKey: str = Form(...),
    issueType: str = Form(None),
    summary: str = Form(...),
    description: str = Form(...),
    product: str = Form(None),
    sprint: str = Form(None),
    attachment: Optional[UploadFile] = File(None)
):
    """Create a Jira ticket. Handles both GRA and DEVOP projects with optional attachment."""
    try:
        if not jira_client:
            raise Exception("Jira client not configured.")

        # Default values for GRA
        assignee = "Khushi Mahajan"
        reporter = "Khushi Mahajan"
        department = "Functional"
        primaryClient = "Internal (ARCON)"
        component = "all"
        priority = "Low"
        endUserOS = "Windows"
        databaseType = "MySql & MSSql"

        new_issue = None

        if projectKey == "DEVOP":
            # ---- DEVOP Project: simple payload with hardcoded defaults ----
            product_value = product or "GRA"
            print(f"Creating DEVOP Task: product={product_value}")

            issue_dict = {
                "project": {"key": "DEVOP"},
                "issuetype": {"name": "Task"},
                "summary": summary,
                "description": description,
                "customfield_10220": {"value": product_value},
                "customfield_10114": {"value": "Functional"},
                "customfield_10230": [{"value": "QA"}],
                "customfield_10156": {"value": "MySql & MSSql"},
                "parent": {"key": "DEVOP-636"},
            }

            print("DEVOP Payload:", issue_dict)
            new_issue = jira_client.create_issue(fields=issue_dict)
            print("Created DEVOP ticket:", new_issue.key)

        else:
            # ---- GRA Project: full payload with metadata resolution ----
            print(f"Creating {issueType} in {projectKey}...")

            fields = get_fields_meta(projectKey, issueType)

            dept_options = get_allowed_values(fields, "customfield_10114")
            pc_options = get_allowed_values(fields, "customfield_10112")
            os_options = get_allowed_values(fields, "customfield_10115")
            db_options = get_allowed_values(fields, "customfield_10156")
            component_options = get_allowed_values(fields, "components")
            priority_options = get_allowed_values(fields, "priority")

            assignee_account_id = get_user_account_id(assignee)
            reporter_account_id = get_user_account_id(reporter)

            issue_dict = {
                "project": {"key": projectKey},
                "issuetype": {"name": issueType},
                "summary": summary,
                "description": description,
                "assignee": {"accountId": assignee_account_id},
                "reporter": {"accountId": reporter_account_id},
                "customfield_10114": find_option_object(dept_options, department, "Department Of Created By"),
                "customfield_10112": find_option_object(pc_options, primaryClient, "Primary Client"),
                "components": [find_component_object(component_options, component)],
                "priority": find_option_object(priority_options, priority, "Priority") if priority_options else {"name": priority},
                "customfield_10115": find_option_object(os_options, endUserOS, "End-User OS"),
                "customfield_10156": find_option_object(db_options, databaseType, "Database Type"),
            }
            
            if sprint:
                try:
                    # Jira Sprint custom field typically takes the sprint ID as an integer
                    issue_dict["customfield_10020"] = int(sprint)
                except ValueError:
                    print(f"Invalid sprint ID: {sprint}")

            print("GRA Payload:", issue_dict)
            new_issue = jira_client.create_issue(fields=issue_dict)
            print("Created GRA ticket:", new_issue.key)

        # Handle Attachment
        if new_issue and attachment:
            print(f"Uploading attachment: {attachment.filename}")
            # Read file content
            file_content = await attachment.read()
            # Wrap in bytes stream
            file_stream = io.BytesIO(file_content)
            # Add to Jira
            jira_client.add_attachment(issue=new_issue, attachment=file_stream, filename=attachment.filename)
            print("Attachment uploaded successfully.")

        return {
            "status": "success",
            "ticketId": new_issue.key,
            "message": "Ticket created successfully with attachment" if attachment else "Ticket created successfully",
            "url": f"{JIRA_SERVER}/browse/{new_issue.key}"
        }
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/move-ticket")
async def move_ticket(request: TicketMoveRequest):
    """Move a Jira ticket to the specified target status."""
    try:
        if not jira_client:
            raise Exception("Jira client not configured.")

        target_status = request.targetStatus.strip()
        print(f"Moving {request.ticketNumber} to '{target_status}'...")

        # Get current status for logging
        issue = jira_client.issue(request.ticketNumber)
        current_status = issue.fields.status.name
        print(f"Current status: '{current_status}'")

        # Fetch all available transitions for this ticket from Jira
        available = jira_client.transitions(request.ticketNumber)
        print(f"Available transitions: {[(t['id'], t['name'], t.get('to',{}).get('name','')) for t in available]}")

        # Find the transition that leads to our target status
        transition_id = None
        for t in available:
            to_name = t.get('to', {}).get('name', '')
            t_name = t.get('name', '')
            # Match by destination status name OR by transition name
            if to_name.strip().lower() == target_status.lower() or t_name.strip().lower() == target_status.lower():
                transition_id = t['id']
                print(f"Matched transition: id={t['id']}, name='{t_name}', to='{to_name}'")
                break

        if not transition_id:
            available_list = [f"{t['name']} (-> {t.get('to',{}).get('name','')})" for t in available]
            raise Exception(
                f"Cannot move {request.ticketNumber} from '{current_status}' to '{target_status}'. "
                f"Available transitions: {available_list}"
            )

        jira_client.transition_issue(request.ticketNumber, transition_id)
        print(f"Successfully moved {request.ticketNumber} from '{current_status}' to '{target_status}'")

        return {
            "status": "success",
            "ticketNumber": request.ticketNumber,
            "previousStatus": current_status,
            "newStatus": target_status
        }
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Helper: find issue key column in a DataFrame ---
def find_ticket_column(df):
    """Smart detection of the issue key column."""
    normalized = {str(col).strip().lower(): col for col in df.columns}

    # Priority 1: exact matches for known key column names
    priority_names = ["issue key", "issue_key", "issuekey", "ticket key", "ticket_key",
                      "jira key", "jira_key", "key", "ticket id", "ticket_id"]
    for name in priority_names:
        if name in normalized:
            print(f"Column match (exact): '{normalized[name]}'")
            return normalized[name]

    # Priority 2: column name contains "key" (but not just "id" or "issue" alone)
    for col_key, original_col in normalized.items():
        if "key" in col_key:
            print(f"Column match (contains 'key'): '{original_col}'")
            return original_col

    # Priority 3: fallback — find column where values look like JIRA keys (ABC-123)
    for col in df.columns:
        sample = df[col].dropna().head(10).astype(str)
        if len(sample) > 0 and sample.apply(lambda x: bool(re.match(r'^[A-Z]+-\d+$', x.strip()))).mean() > 0.5:
            print(f"Column match (value pattern): '{col}'")
            return col
    return None


def is_valid_issue_key(key):
    return bool(re.match(r'^[A-Z]+-\d+$', str(key).strip()))


@app.post("/move-tickets-bulk")
async def move_tickets_bulk(
    file: UploadFile = File(...),
    sourceStatus: str = Form(...),
    targetStatus: str = Form(...),
):
    """Bulk move tickets from an uploaded Excel/CSV file."""
    try:
        if not jira_client:
            raise Exception("Jira client not configured.")

        # Read file
        contents = await file.read()
        filename = file.filename.lower()

        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise Exception("Unsupported file format. Use .xlsx, .xls, or .csv")

        print(f"Uploaded: {file.filename}, columns: {list(df.columns)}, rows: {len(df)}")

        ticket_col = find_ticket_column(df)
        if not ticket_col:
            raise Exception(f"Could not find a ticket/issue key column. Columns found: {list(df.columns)}")

        print(f"Using column: '{ticket_col}', source='{sourceStatus}', target='{targetStatus}'")

        results = []
        for raw_ticket in df[ticket_col].dropna():
            issue_key = str(raw_ticket).strip().upper()
            row = {"ticket_id": issue_key, "current_status": "", "action": "", "details": ""}

            if not is_valid_issue_key(issue_key):
                row["action"] = "skipped"
                row["details"] = "Invalid ticket format"
                results.append(row)
                continue

            try:
                issue = jira_client.issue(issue_key)
                current_status = issue.fields.status.name
                row["current_status"] = current_status

                # Check if ticket is in the expected source status
                if current_status.strip().lower() != sourceStatus.strip().lower():
                    row["action"] = "skipped"
                    row["details"] = f"Status is '{current_status}', not '{sourceStatus}'"
                    print(f"[SKIP] {issue_key}: {current_status}")
                    results.append(row)
                    continue

                # Find transition to target status
                transitions = jira_client.transitions(issue)
                transition_id = None
                for t in transitions:
                    to_name = (t.get('to', {}).get('name', '') or '').strip().lower()
                    t_name = (t.get('name', '') or '').strip().lower()
                    if to_name == targetStatus.strip().lower() or t_name == targetStatus.strip().lower():
                        transition_id = t['id']
                        break

                if not transition_id:
                    available = [f"{t['name']} -> {t.get('to',{}).get('name','')}" for t in transitions]
                    row["action"] = "failed"
                    row["details"] = f"No transition to '{targetStatus}'. Available: {available}"
                    print(f"[FAIL] {issue_key}: no transition")
                    results.append(row)
                    continue

                jira_client.transition_issue(issue, transition_id)
                row["action"] = "updated"
                row["details"] = f"Moved from '{sourceStatus}' to '{targetStatus}'"
                print(f"[OK] {issue_key}: moved to {targetStatus}")

            except Exception as e:
                error_msg = str(e)
                if "404" in error_msg:
                    msg = "Issue not found or no permission"
                elif "401" in error_msg:
                    msg = "Authentication failed"
                else:
                    msg = error_msg[:120]
                row["action"] = "failed"
                row["details"] = msg
                print(f"[ERROR] {issue_key}: {msg}")

            results.append(row)

        updated = sum(1 for r in results if r['action'] == 'updated')
        print(f"Bulk complete: {updated}/{len(results)} moved")

        return {"status": "success", "results": results}

    except Exception as e:
        print(f"Bulk error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    print("Starting Jira backend API on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
