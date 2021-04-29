import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import {
    Counts,
    KeyValue,
    Analysis,
    PipelineStatus,
    Dataset,
    Info,
    DataEntryRowBase,
    DataEntryRowOptional,
    DataEntryRowRNASeq,
    FieldDisplayValueType,
    Field,
    DataEntryRow,
    PseudoBoolean,
    PseudoBooleanReadableMap,
} from "./typings";

dayjs.extend(utc);
dayjs.extend(LocalizedFormat);

export function countArray(items: string[]) {
    return items.reduce<Counts>((counts, item) => {
        if (counts[item]) {
            counts[item] += 1;
        } else {
            counts[item] = 1;
        }
        return counts;
    }, Object.create(null));
}

export function toKeyValue(items: string[]) {
    return items.reduce<KeyValue>((map, item) => {
        map[item] = item;
        return map;
    }, Object.create(null));
}

/**
 * Convert an ISO datetime to human-readable format in the user's locale.
 */
export function formatDateString(date: string) {
    const datetime = dayjs.utc(date);
    return datetime.local().format("LLLL");
}

/**
 * Convert the provided JSON Array to a valid array of Analysis.
 */
export function jsonToAnalyses(data: Array<any>): Analysis[] {
    const rows: Analysis[] = data.map((row, index, arr) => {
        switch (row.analysis_state) {
            case "Requested":
                row.state = PipelineStatus.PENDING;
                break;
            case "Running":
                row.state = PipelineStatus.RUNNING;
                break;
            case "Done":
                row.state = PipelineStatus.COMPLETED;
                break;
            case "Error":
                row.state = PipelineStatus.ERROR;
                break;
            case "Cancelled":
                row.state = PipelineStatus.CANCELLED;
                break;
            default:
                row.state = null;
                break;
        }
        return { ...row } as Analysis;
    });
    return rows;
}

/**
 * Get the index of a material-table row.
 * If a material-table row is not provided, return null.
 */
export function getRowIndex(row: any): number | null {
    return row.tableData?.id;
}

/**
 * Return whether this material-table row is checked / selected.
 * If it is not a material-table row, return null.
 */
export function isRowSelected(row: any): boolean {
    return !!row?.tableData?.checked;
}

/**
 * Return the titles and values  of analysis detail as a Field Object in dialogs
 */
export function getAnalysisFields(analysis: Analysis) {
    return [
        createFieldObj("Analysis ID", analysis.analysis_id),
        createFieldObj("State", analysis.analysis_state),
        createFieldObj("Pipeline ID", analysis.pipeline_id),
        createFieldObj("Assigned to", analysis.assignee),
        createFieldObj("Path Prefix", analysis.result_path),
        createFieldObj("qSub ID", analysis.qsubID),
        createFieldObj("Notes", analysis.notes),
        createFieldObj("Requested", formatDateString(analysis.requested)),
        createFieldObj("Requested By", analysis.requester),
        createFieldObj("Started", formatDateString(analysis.started)),
        createFieldObj("Last Updated", formatDateString(analysis.updated)),
    ];
}

/**
 * Return an Info object for analysis detail list in dialogs
 */
export function getAnalysisInfoList(analyses: Analysis[]): Info[] {
    return analyses.map(analysis => {
        return {
            primaryListTitle: `Analysis ID ${analysis.analysis_id}`,
            secondaryListTitle: `Current State: ${analysis.analysis_state} - Click for more details`,
            fields: getAnalysisFields(analysis),
            identifier: analysis.analysis_id,
        };
    });
}

/**
 * Return the titles and values of dataset detail as a Field object in dialogs
 */
export function getDatasetFields(dataset: Dataset) {
    return [
        createFieldObj("Dataset Type", dataset.dataset_type, "dataset_type"),
        createFieldObj(
            "Participant Codename",
            dataset.participant_codename,
            "participant_codename",
            true
        ),
        createFieldObj("Family Codename", dataset.family_codename, "family_codename", true),
        createFieldObj("Tissue ID", dataset.tissue_sample_id, "tissue_sample_id", true),
        createFieldObj("Sequencing Centre", dataset.sequencing_centre, "sequencing_centre"),
        createFieldObj("Notes", dataset.notes, "notes"),
        createFieldObj("Created", formatDateString(dataset.created), "created", true),
        createFieldObj("Created By", dataset.created_by, "created_by", true),
        createFieldObj("Updated", formatDateString(dataset.updated), "updated", true),
        createFieldObj("Updated By", dataset.updated_by, "updated_by", true),
    ];
}

/**
 * Return the secondary titles and values (hidden in show more detail) of dataset detail as a Field object in dialogs
 */
export function getSecDatasetFields(dataset: Dataset) {
    return [
        createFieldObj("Batch ID", dataset.batch_id, "batch_id"),
        createFieldObj("Linked Files", dataset.linked_files, "linked_files"),
        createFieldObj("Condition", dataset.condition, "condition"),
        createFieldObj("Extraction Protocol", dataset.extraction_protocol, "extraction_protocol"),
        createFieldObj("Capture Kit", dataset.capture_kit, "capture_kit"),
        createFieldObj("Discriminator", dataset.discriminator, "discriminator"),
        createFieldObj("Library Prep Method", dataset.library_prep_method, "library_prep_method"),
        createFieldObj(
            "Library Prep Date",
            formatDateString(dataset.library_prep_date),
            "library_prep_date"
        ),
        createFieldObj("Read Length", dataset.read_length, "read_length"),
        createFieldObj("Read Type", dataset.read_type, "read_type"),
        createFieldObj("Sequencing ID", dataset.sequencing_id, "sequencing_id"),
    ];
}

/**
 * Return an Info object for dataset detail list in dialogs
 */
export function getDatasetInfoList(datasets: Dataset[]): Info[] {
    return datasets.map(dataset => {
        return {
            primaryListTitle: `Dataset ID ${dataset.dataset_id}`,
            secondaryListTitle: `Participant: ${dataset.participant_codename} - Click for more details`,
            fields: getDatasetFields(dataset),
            collapsibleFields: getSecDatasetFields(dataset),
            identifier: dataset.dataset_id,
        };
    });
}

/**
 * Set property of object at key to newValue. Return obj.
 *
 * @example
 * let obj = { a: 1, b: 2 };
 * setProp(obj, "a", 3);     // returns { a: 3, b: 2 }
 * obj.a === 3               // returns true
 */
export function setProp<T, K extends keyof T>(obj: T, key: K, newValue: any) {
    obj[key] = newValue;
    return obj;
}

/**
 * Return an object containing all headers for DataEntryTable.
 */
export function getDataEntryHeaders() {
    return {
        required: Object.keys(new DataEntryRowBase()) as Array<keyof DataEntryRowBase>,
        optional: Object.keys(new DataEntryRowOptional()) as Array<keyof DataEntryRowOptional>,
        RNASeq: Object.keys(new DataEntryRowRNASeq()) as Array<keyof DataEntryRowRNASeq>,
    };
}

/**
 * Given a string in snake-case (eg. thing_name), returns the string
 * in spaced Title case (eg. Thing Name).
 *
 * Assume that input string is alphanumeric with underscores.
 */
export function snakeCaseToTitle(str: string): string {
    return str.split("_").map(toTitleCase).join(" ");
}

/**
 * Given a string, returns the string with first word capitalized
 */
export function toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

export function createFieldObj(
    title: string,
    value: FieldDisplayValueType,
    fieldName?: string,
    disableEdit?: boolean
): Field {
    return {
        title: title,
        value: value,
        fieldName: fieldName,
        disableEdit: disableEdit,
    };
}

/**
 * Convert given table to CSV and downloads it to user.
 */
export const downloadCsv = (filename: string, blob: Blob) => {
    const downloadLink = document.createElement("a");
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.click();
    URL.revokeObjectURL(url);
};

/**
 * Used for material-table exportCSV.
 */
export function rowDataToTable(columnDefs: any[], data: any[]) {
    const headers = columnDefs.map(columnDef => `"${columnDef.field}"`);
    const dataRows = data.map(rowData =>
        columnDefs.map(columnDef => `"${rowData[columnDef.field]}"`)
    );
    return [headers].concat(dataRows) as string[][];
}

/**
 * Alias for the above two functions together. Generates a table given the columnDefs and
 * rowData, and downloads as CSV.
 */
export function exportCSV(columnDefs: any[], data: any[], filename: string) {
    const table = rowDataToTable(columnDefs, data);
    const rows = table.map(row => row.join(",")).join("\r\n");
    const blob = new Blob([rows], {
        type: "text/csv;charset=utf-8",
    });

    downloadCsv(filename, blob);
}

export function createEmptyRows(amount?: number): DataEntryRow[] {
    if (!amount || amount < 1) amount = 1;

    var arr = [];
    for (let i = 0; i < amount; i++) {
        arr.push({
            family_codename: "",
            participant_codename: "",
            participant_type: "",
            tissue_sample_type: "",
            dataset_type: "",
            condition: "GermLine",
            sequencing_date: "",
        });
    }
    return arr;
}

export function stringToBoolean(value: PseudoBoolean) {
    switch (value) {
        case "true":
            return true;
        case "false":
            return false;
        case "null":
            return null;
        default:
            return value;
    }
}

/**
 * Return an object containing the key-value pairs that differ between
 * oldRow and newRow, with the values from newRow.
 *
 * @param newRow
 * @param oldRow
 */
export function rowDiff<T>(newRow: T, oldRow: T | undefined): Partial<T> {
    if (!oldRow) {
        return { ...newRow };
    } else {
        let diffRow: any = {};
        let k: keyof T;
        for (k in oldRow) {
            if (newRow[k] !== oldRow[k]) {
                diffRow[k] = newRow[k];
            }
        }
        return { ...diffRow };
    }
}

/**
 * Formats the provided FieldDisplay value as a user-readable string.
 */
export function formatFieldValue(value: FieldDisplayValueType, nullUnknown: boolean = false) {
    let val = value;
    if (Array.isArray(value)) val = value.join(", ");
    else if (value === null || value === undefined)
        nullUnknown ? (val = PseudoBooleanReadableMap[("" + value) as PseudoBoolean]) : (val = "");
    else if (typeof value === "boolean")
        val = PseudoBooleanReadableMap[("" + value) as PseudoBoolean];
    return val;
}

/**
 * Return true if the string is empty or contains only whitespace, false otherwise.
 */
export function strIsEmpty(str?: string): boolean {
    const testRegex = /\S/g;
    return str ? !testRegex.test(str) : true;
}

/**
 * Update a material-table filter from outside the table
 * MaterialTable holds its own state, so to avoid a rerender and state flush we need to get a handle \
 * on the instance, make imperative updates, and force an internal state change
 */
export const updateTableFilter = (
    tableRef: React.MutableRefObject<any>,
    column: string,
    filterVal: string | string[]
) => {
    if (tableRef.current) {
        const col = tableRef.current.dataManager.columns.find((c: any) => c.field === column);
        if (col) {
            col.tableData.filterValue = filterVal;
            tableRef.current.dataManager.changeApplyFilters(true);
            tableRef.current.dataManager.filterData();
            tableRef.current.onFilterChangeDebounce();
            tableRef.current.onQueryChange();
        }
    }
};
