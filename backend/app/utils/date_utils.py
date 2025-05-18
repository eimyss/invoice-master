# backend/app/utils/date_utils.py (Example new file)
from datetime import datetime, date, timedelta, timezone

def get_month_range(year: int, month: int) -> (datetime, datetime):
    """Returns the start and end datetime (UTC midnight) for a given month and year."""
    start_of_month = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
    if month == 12:
        end_of_month = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc) - timedelta(microseconds=1)
    else:
        end_of_month = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=timezone.utc) - timedelta(microseconds=1)
    # Or, for end of month, you can simply go to the start of the next month
    # and use $lt (less than) in your MongoDB query.
    # For $lte (less than or equal), you need the very end of the last day.
    # Let's use start of current month and start of next month for easier querying with $gte and $lt
    if month == 12:
        start_of_next_month = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    else:
        start_of_next_month = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    return start_of_month, start_of_next_month
