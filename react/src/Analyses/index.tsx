import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useParams } from "react-router";
import { Chip, IconButton, Container, Select, MenuItem, useTheme } from "@material-ui/core";
import {
    Cancel,
    Add,
    Visibility,
    PlayArrow,
    PersonPin,
    AssignmentTurnedIn,
    Error,
} from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import MaterialTable, { MTableToolbar, Column, EditComponentProps } from "material-table";
import { useSnackbar } from "notistack";
import { UseMutationResult } from "react-query";
import { isRowSelected, exportCSV, updateTableFilter, toTitleCase, toKeyValue } from "../functions";
import { Analysis, PipelineStatus } from "../typings";
import {
    AnalysisInfoDialog,
    Note,
    EditNotes,
    DateTimeText,
    DateFilterComponent,
} from "../components";
import {
    AnalysisOptions,
    useAnalysesPage,
    useAnalysisUpdateMutation,
    useEnumsQuery,
} from "../hooks";
import CancelAnalysisDialog from "./components/CancelAnalysisDialog";
import AddAnalysisAlert from "./components/AddAnalysisAlert";
import SetAssigneeDialog from "./components/SetAssigneeDialog";
import PipelineFilter from "./components/PipelineFilter";

const useStyles = makeStyles(theme => ({
    appBarSpacer: theme.mixins.toolbar,
    content: {
        flexGrow: 1,
        height: "100vh",
        overflow: "auto",
    },
    container: {
        paddingTop: theme.spacing(3),
        paddingBottom: theme.spacing(3),
    },
    chip: {
        color: "primary",
        marginRight: "10px",
        colorPrimary: theme.palette.primary,
    },
}));

function pipeName(row: Analysis) {
    if (row.pipeline) {
        return `${row.pipeline.pipeline_name} ${row.pipeline.pipeline_version}`;
    } else {
        return "";
    }
}

// Returns the analysis IDs of the provided rows, optionally delimited with delim
function rowsToString(rows: Analysis[], delim?: string) {
    let returnStr = "";
    if (delim) {
        rows.forEach(row => (returnStr = returnStr.concat(`${row.analysis_id}${delim}`)));
    } else {
        rows.forEach(
            (row, index, arr) =>
                (returnStr = returnStr.concat(
                    index < arr.length - 1 ? `${row.analysis_id}, ` : `${row.analysis_id}`
                ))
        );
    }
    return returnStr;
}

/**
 * Returns whether this row can be completed.
 */
function completeFilter(row: Analysis) {
    return row.analysis_state === PipelineStatus.RUNNING;
}

/**
 * Returns whether it's possible for this row to error.
 */
function errorFilter(row: Analysis) {
    return (
        row.analysis_state === PipelineStatus.RUNNING ||
        row.analysis_state === PipelineStatus.PENDING
    );
}

/**
 * Returns whether this analysis is allowed to be cancelled.
 */
function cancelFilter(row: Analysis) {
    return (
        row.analysis_state === PipelineStatus.RUNNING ||
        row.analysis_state === PipelineStatus.PENDING
    );
}

/**
 * Returns whether this analysis is allowed to be run.
 */
function runFilter(row: Analysis) {
    return row.analysis_state === PipelineStatus.PENDING;
}

/**
 * Updates the state of all selected rows.
 * Returns a new list of Analyses, as well as the number of rows that changed, were skipped, or failed to change.
 * TODO: Revisit after overfetch #283
 *
 * @param selectedRows
 * @param filter A function which returns true for a row that is allowed to be changed to newState, false otherwise.
 * @param mutation The mutation object to use to update the analyses.
 * @param newState The new state to apply to rows which pass the filter.
 */
async function _changeStateForSelectedRows(
    selectedRows: Analysis[],
    filter: (row: Analysis) => boolean,
    mutation: UseMutationResult<Analysis, Response, AnalysisOptions>,
    newState: PipelineStatus
) {
    let changed = 0;
    let skipped = 0;
    let failed = 0;
    for (let i = 0; i < selectedRows.length; i++) {
        let row = selectedRows[i];
        if (filter(row)) {
            try {
                await mutation.mutateAsync({
                    analysis_id: row.analysis_id,
                    analysis_state: newState,
                    source: "selection",
                });
                changed++;
            } catch (res) {
                failed++;
                console.error(res);
            }
        } else if (isRowSelected(row)) {
            skipped++;
        }
    }
    return { changed, skipped, failed };
}

const exportCsv = (columns: Column<Analysis>[], data: any[]) =>
    exportCSV(columns, data, "Analyses");

const renderNotes = (rowData: Analysis) => <Note>{rowData.notes}</Note>;

const renderDateTime = (rowData: Analysis) => <DateTimeText datetime={rowData.updated} />;

const renderDateFilter = (props: any) => <DateFilterComponent {...props} />;

const renderPipeName = (row: Analysis) => pipeName(row);

const renderPipeFilter = (props: {
    columnDef: Column<Analysis>;
    onFilterChanged: (rowId: string, value: any) => void;
}) => <PipelineFilter {...props} />;

export default function Analyses() {
    const classes = useStyles();
    const [detail, setDetail] = useState(false); // for detail dialog
    const [cancel, setCancel] = useState(false); // for cancel dialog
    const [direct, setDirect] = useState(false); // for add analysis dialog (re-direct)
    const [assignment, setAssignment] = useState(false); // for set assignee dialog

    const dataFetch = useAnalysesPage();

    const analysisUpdateMutation = useAnalysisUpdateMutation();

    const { data: enums } = useEnumsQuery();

    const theme = useTheme();

    const priorityLookup = useMemo(() => toKeyValue(enums?.PriorityType || []), [enums]);

    const [activeRows, setActiveRows] = useState<Analysis[]>([]);

    const history = useHistory();

    const { enqueueSnackbar } = useSnackbar();
    const { id: paramID } = useParams<{ id: string }>();

    useEffect(() => {
        document.title = `Analyses | ${process.env.REACT_APP_NAME}`;
    }, []);

    const tableRef = useRef<any>();

    const PrioritySelectComponent = useMemo(
        () => ({ onChange, value }: EditComponentProps<Analysis>) => {
            return (
                <Select
                    value={value || "None"}
                    onChange={event =>
                        onChange(event.target.value === "None" ? null : event.target.value)
                    }
                    fullWidth
                >
                    {enums?.PriorityType.map(p => (
                        <MenuItem key={p} value={p}>
                            {p}
                        </MenuItem>
                    ))}
                    <MenuItem value="None">None</MenuItem>
                </Select>
            );
        },
        [enums]
    );

    function changeAnalysisState(filter: (row: Analysis) => boolean, newState: PipelineStatus) {
        return _changeStateForSelectedRows(activeRows, filter, analysisUpdateMutation, newState);
    }

    const getRowStyle = useMemo(
        () => (data: Analysis) => {
            const { priority, analysis_state } = data || {};
            const statusRelevant = [PipelineStatus.PENDING, PipelineStatus.RUNNING].includes(
                analysis_state
            );

            if (statusRelevant && priority === "Research") {
                return { backgroundColor: theme.palette.warning.light };
            }
            if (statusRelevant && priority === "Clinical") {
                return { backgroundColor: theme.palette.error.light };
            }
            return {};
        },
        [theme.palette.error.light, theme.palette.warning.light]
    );

    return (
        <main className={classes.content}>
            <div className={classes.appBarSpacer} />
            {activeRows.length > 0 && (
                <CancelAnalysisDialog
                    open={cancel}
                    affectedRows={activeRows}
                    title={activeRows.length === 1 ? `Stop Analysis?` : `Stop Analyses?`}
                    onClose={() => {
                        setCancel(false);
                    }}
                    onAccept={() => {
                        changeAnalysisState(cancelFilter, PipelineStatus.CANCELLED).then(
                            ({ changed, skipped, failed }) => {
                                setCancel(false);
                                if (changed > 0)
                                    enqueueSnackbar(
                                        `${changed} ${
                                            changed !== 1 ? "analyses" : "analysis"
                                        } cancelled successfully`,
                                        { variant: "success" }
                                    );
                                if (skipped > 0)
                                    enqueueSnackbar(
                                        `${skipped} ${
                                            skipped !== 1 ? "analyses were" : "analysis was"
                                        } not running, and ${
                                            skipped !== 1 ? "were" : "was"
                                        } skipped`
                                    );
                                if (failed > 0)
                                    enqueueSnackbar(
                                        `Failed to cancel ${failed} ${
                                            failed !== 1 ? "analyses" : "analysis"
                                        }`,
                                        { variant: "error" }
                                    );
                            }
                        );
                    }}
                    cancelFilter={cancelFilter}
                    labeledByPrefix={`${rowsToString(activeRows, "-")}`}
                    describedByPrefix={`${rowsToString(activeRows, "-")}`}
                />
            )}

            {activeRows.length > 0 && (
                <AnalysisInfoDialog
                    open={detail}
                    analysis={activeRows[0]}
                    onClose={() => {
                        setDetail(false);
                    }}
                />
            )}

            <AddAnalysisAlert
                open={direct}
                onClose={() => {
                    setDirect(false);
                }}
                onAccept={() => {
                    setDirect(false);
                    history.push("/datasets");
                }}
            />

            {activeRows.length > 0 && (
                <SetAssigneeDialog
                    affectedRows={activeRows}
                    open={assignment}
                    onClose={() => {
                        setAssignment(false);
                    }}
                    onSubmit={async username => {
                        let count = 0;
                        let failed = 0;
                        for (const row of activeRows) {
                            try {
                                await analysisUpdateMutation.mutateAsync({
                                    analysis_id: row.analysis_id,
                                    assignee: username,
                                });
                                count++;
                            } catch (res) {
                                failed++;
                                console.error(res);
                            }
                        }
                        setAssignment(false);
                        if (count > 0) {
                            enqueueSnackbar(
                                `${count} analyses successfully assigned to user '${username}'`,
                                { variant: "success" }
                            );
                        }
                        if (failed > 0) {
                            enqueueSnackbar(
                                `${failed} analyses could not be assigned to '${username}'`,
                                { variant: "error" }
                            );
                        }
                    }}
                />
            )}

            <Container maxWidth={false} className={classes.container}>
                <MaterialTable
                    tableRef={tableRef}
                    columns={[
                        {
                            title: "Analysis ID",
                            field: "analysis_id",
                            type: "string",
                            editable: "never",
                            width: "8%",
                            defaultFilter: paramID,
                        },
                        {
                            title: "Pipeline",
                            field: "pipeline_id",
                            type: "string",
                            width: "8%",
                            editable: "never",
                            render: renderPipeName,
                            filterComponent: renderPipeFilter,
                        },
                        {
                            title: "Assignee",
                            field: "assignee",
                            type: "string",
                            editable: "never",
                            width: "8%",
                        },
                        {
                            title: "Priority",
                            field: "priority",
                            type: "string",
                            width: "8%",
                            lookup: priorityLookup,
                            editComponent: PrioritySelectComponent,
                        },
                        {
                            title: "Requester",
                            field: "requester",
                            type: "string",
                            editable: "never",
                            width: "8%",
                        },
                        {
                            title: "Updated",
                            field: "updated",
                            type: "string",
                            editable: "never",
                            render: renderDateTime,
                            filterComponent: renderDateFilter,
                        },
                        {
                            title: "Path Prefix",
                            field: "result_path",
                            type: "string",
                        },
                        {
                            title: "Status",
                            field: "analysis_state",
                            type: "string",
                            editable: "never",
                        },
                        {
                            title: "Notes",
                            field: "notes",
                            type: "string",
                            render: renderNotes,
                            editComponent: EditNotes,
                        },
                    ]}
                    isLoading={analysisUpdateMutation.isLoading}
                    data={dataFetch}
                    title="Analyses"
                    options={{
                        pageSize: 10,
                        filtering: true,
                        search: false,
                        padding: "dense",
                        selection: true,
                        exportAllData: true,
                        exportButton: { csv: true, pdf: false },
                        exportCsv: exportCsv,
                        rowStyle: getRowStyle,
                    }}
                    actions={[
                        {
                            icon: Visibility,
                            tooltip: "View analysis details",
                            position: "row",
                            onClick: (event, rowData) => {
                                // We can only view details of one row at a time
                                setActiveRows([rowData as Analysis]);
                                setDetail(true);
                            },
                        },
                        {
                            icon: Cancel,
                            tooltip: "Cancel analysis",
                            position: "toolbarOnSelect",
                            onClick: (event, rowData) => {
                                setActiveRows(rowData as Analysis[]);
                                setCancel(true);
                            },
                        },
                        {
                            icon: Add,
                            tooltip: "Add New Analysis",
                            position: "toolbar",
                            isFreeAction: true,
                            onClick: () => setDirect(true),
                        },
                        {
                            icon: PlayArrow,
                            tooltip: "Run analysis",
                            position: "toolbarOnSelect",
                            onClick: (event, rowData) => {
                                setActiveRows(rowData as Analysis[]);
                                changeAnalysisState(runFilter, PipelineStatus.RUNNING).then(
                                    ({ changed, skipped, failed }) => {
                                        if (changed > 0)
                                            enqueueSnackbar(
                                                `${changed} ${
                                                    changed !== 1 ? "analyses" : "analysis"
                                                } started successfully`,
                                                { variant: "success" }
                                            );
                                        if (skipped > 0)
                                            enqueueSnackbar(
                                                `${skipped} ${
                                                    skipped !== 1 ? "analyses were" : "analysis was"
                                                } already queued or cancelled, and ${
                                                    skipped !== 1 ? "were" : "was"
                                                } skipped`
                                            );
                                        if (failed > 0)
                                            enqueueSnackbar(
                                                `Failed to start ${failed} ${
                                                    failed !== 1 ? "analyses" : "analysis"
                                                }`,
                                                { variant: "error" }
                                            );
                                    }
                                );
                            },
                        },
                        {
                            icon: AssignmentTurnedIn,
                            tooltip: "Complete analysis",
                            position: "toolbarOnSelect",
                            onClick: (event, rowData) => {
                                setActiveRows(rowData as Analysis[]);
                                changeAnalysisState(completeFilter, PipelineStatus.COMPLETED).then(
                                    ({ changed, skipped, failed }) => {
                                        if (changed > 0)
                                            enqueueSnackbar(
                                                `${changed} ${
                                                    changed !== 1 ? "analyses" : "analysis"
                                                } completed successfully`,
                                                { variant: "success" }
                                            );
                                        if (skipped > 0)
                                            enqueueSnackbar(
                                                `${skipped} ${
                                                    skipped !== 1 ? "analyses" : "analysis"
                                                } ${
                                                    skipped !== 1 ? "were" : "was"
                                                } not running, and ${
                                                    skipped !== 1 ? "were" : "was"
                                                } skipped`
                                            );
                                        if (failed > 0)
                                            enqueueSnackbar(
                                                `Failed to complete ${failed} ${
                                                    failed !== 1 ? "analyses" : "analysis"
                                                }`,
                                                { variant: "error" }
                                            );
                                    }
                                );
                            },
                        },
                        {
                            icon: Error,
                            tooltip: "Error analysis",
                            position: "toolbarOnSelect",
                            onClick: (event, rowData) => {
                                setActiveRows(rowData as Analysis[]);
                                changeAnalysisState(errorFilter, PipelineStatus.ERROR).then(
                                    ({ changed, skipped, failed }) => {
                                        if (changed > 0)
                                            enqueueSnackbar(
                                                `${changed} ${
                                                    changed !== 1 ? "analyses" : "analysis"
                                                } errored successfully`,
                                                { variant: "success" }
                                            );
                                        if (skipped > 0)
                                            enqueueSnackbar(
                                                `${skipped} ${
                                                    skipped !== 1 ? "analyses" : "analysis"
                                                } ${
                                                    skipped !== 1 ? "were" : "was"
                                                } not running or queued, and ${
                                                    skipped !== 1 ? "were" : "was"
                                                } skipped`
                                            );
                                        if (failed > 0)
                                            enqueueSnackbar(
                                                `Failed to error ${failed} ${
                                                    failed !== 1 ? "analyses" : "analysis"
                                                }`,
                                                { variant: "error" }
                                            );
                                    }
                                );
                            },
                        },
                        {
                            icon: PersonPin,
                            tooltip: "Assign to...",
                            onClick: (event, rowData) => {
                                // Data handled by SetAssigneeDialog onSubmit
                                setActiveRows(rowData as Analysis[]);
                                setAssignment(true);
                            },
                        },
                    ]}
                    editable={{
                        onRowUpdate: async (newData, oldData) => {
                            analysisUpdateMutation.mutate(
                                { ...newData, source: "row-edit" },
                                {
                                    onSuccess: () => {
                                        enqueueSnackbar(
                                            `Analysis ID ${oldData?.analysis_id} edited successfully`,
                                            { variant: "success" }
                                        );
                                        //refresh data
                                        tableRef.current.onQueryChange();
                                    },
                                    onError: response => {
                                        enqueueSnackbar(
                                            `Failed to edit Analysis ID ${oldData?.analysis_id} - ${response.status} ${response.statusText}`,
                                            { variant: "error" }
                                        );
                                        console.error(response);
                                    },
                                }
                            );
                        },
                    }}
                    components={{
                        Toolbar: props => (
                            <div>
                                <MTableToolbar {...props} />
                                <div style={{ marginLeft: "24px" }}>
                                    {Object.entries(PipelineStatus).map(([k, v]) => (
                                        <Chip
                                            key={k}
                                            label={toTitleCase(k)}
                                            clickable
                                            className={classes.chip}
                                            onClick={() =>
                                                updateTableFilter(tableRef, "analysis_state", v)
                                            }
                                        />
                                    ))}
                                    <IconButton
                                        onClick={() =>
                                            updateTableFilter(tableRef, "analysis_state", "")
                                        }
                                    >
                                        <Cancel />
                                    </IconButton>
                                </div>
                            </div>
                        ),
                    }}
                    localization={{
                        header: {
                            actions: "", //remove action buttons' header
                        },
                    }}
                />
            </Container>
        </main>
    );
}
