import React, { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { makeStyles, Chip, IconButton } from "@material-ui/core";
import { PlayArrow, Delete, Cancel, Visibility } from "@material-ui/icons";
import MaterialTable, { EditComponentProps, MTableToolbar } from "material-table";
import { useSnackbar } from "notistack";
import { useQueryClient } from "react-query";
import { toKeyValue, exportCSV, rowDiff, updateTableFilter } from "../../functions";
import { Dataset } from "../../typings";
import AnalysisRunnerDialog from "./AnalysisRunnerDialog";
import DatasetInfoDialog from "./DatasetInfoDialog";
import {
    DateTimeText,
    DateFilterComponent,
    EditNotes,
    Note,
    FileLinkingComponent,
} from "../../components";
import LinkedFilesButton from "./LinkedFilesButton";
import {
    useDatasetUpdateMutation,
    useEnumsQuery,
    useMetadatasetTypesQuery,
    useUnlinkedFilesQuery,
    useDatasetsPage,
} from "../../hooks";
import { useUserContext } from "../../contexts";

const useStyles = makeStyles(theme => ({
    chip: {
        color: "primary",
        marginRight: "10px",
        colorPrimary: theme.palette.primary,
    },
    chipBar: {
        marginLeft: "24px",
        marginTop: "6px",
    },
}));

const customFileFilterAndSearch = (filter: string, rowData: Dataset) => {
    return (
        filter === "" + rowData.linked_files.length ||
        rowData.linked_files.some(name => name.includes(filter))
    );
};

const EditFilesComponent = (props: EditComponentProps<Dataset>) => {
    const filesQuery = useUnlinkedFilesQuery();
    const files = filesQuery.data || [];
    return (
        <FileLinkingComponent
            values={props.rowData.linked_files}
            options={files.map(file => ({ title: file, inputValue: file }))}
            onEdit={(newValue: string[]) => props.onChange(newValue)}
            disableTooltip
        />
    );
};

const linkedFileSort = (a: { linked_files: string[] }, b: { linked_files: string[] }) =>
    a.linked_files.length - b.linked_files.length;

const RenderDatePicker = (rowData: Dataset) => <DateTimeText datetime={rowData.updated} />;

const RenderLinkedFilesButton = (props: Dataset) => (
    <LinkedFilesButton fileNames={props.linked_files} />
);

const RenderNotes = (rowData: Dataset) => <Note>{rowData.notes}</Note>;

const wrappedExportCsv = (columns: any[], data: any[]) => exportCSV(columns, data, "Datasets");

export default function DatasetTable() {
    const classes = useStyles();
    const { user: currentUser } = useUserContext();
    const queryClient = useQueryClient();
    const [showRunner, setRunner] = useState(false);
    const [selectedDatasets, setSelectedDatasets] = useState<Dataset[]>([]);

    const dataFetch = useDatasetsPage();
    const datasetUpdateMutation = useDatasetUpdateMutation();
    const { data: enums } = useEnumsQuery();
    const { data: metadatasetTypes } = useMetadatasetTypesQuery();
    const datasetTypes = useMemo(
        () => metadatasetTypes && toKeyValue(Object.values(metadatasetTypes).flat()),
        [metadatasetTypes]
    );
    const tissueSampleTypes = useMemo(() => enums && toKeyValue(enums.TissueSampleType), [enums]);
    const conditions = useMemo(() => enums && toKeyValue(enums.DatasetCondition), [enums]);

    const filesQuery = useUnlinkedFilesQuery();
    const files = filesQuery.data || [];

    const [showInfo, setShowInfo] = useState(false);
    const [infoDataset, setInfoDataset] = useState<Dataset>();

    const { enqueueSnackbar } = useSnackbar();

    const { id: paramID } = useParams<{ id?: string }>();

    //setting to `any` b/c MTable typing doesn't include dataManager
    const MTRef = useRef<any>();

    return (
        <div>
            <AnalysisRunnerDialog
                datasets={selectedDatasets}
                open={showRunner}
                onClose={() => setRunner(false)}
            />
            {infoDataset && (
                <DatasetInfoDialog
                    dataset={infoDataset}
                    open={showInfo}
                    onClose={() => {
                        setShowInfo(false);
                    }}
                />
            )}
            <MaterialTable
                tableRef={MTRef}
                columns={[
                    { title: "Participant", field: "participant_codename", editable: "never" },
                    { title: "Family", field: "family_codename", editable: "never" },
                    {
                        title: "Tissue Sample",
                        field: "tissue_sample_type",
                        editable: "never",
                        lookup: tissueSampleTypes,
                    },
                    {
                        title: "Type",
                        field: "dataset_type",
                        lookup: datasetTypes,
                    },
                    {
                        title: "Condition",
                        field: "condition",
                        lookup: conditions,
                    },
                    {
                        title: "Notes",
                        field: "notes",
                        render: RenderNotes,
                        editComponent: EditNotes,
                    },
                    {
                        title: "Files",
                        field: "linked_files",
                        // can search by number of files, or by file name
                        customFilterAndSearch: customFileFilterAndSearch,
                        customSort: linkedFileSort,
                        render: RenderLinkedFilesButton,
                        editComponent: EditFilesComponent,
                    },
                    {
                        title: "Updated",
                        field: "updated",
                        type: "string",
                        editable: "never",
                        render: RenderDatePicker,
                        filterComponent: DateFilterComponent,
                    },
                    { title: "Updated By", field: "updated_by", editable: "never" },
                    {
                        title: "ID",
                        field: "dataset_id",
                        editable: "never",
                        defaultFilter: paramID,
                    },
                ]}
                data={dataFetch}
                title="Datasets"
                options={{
                    pageSize: 10,
                    selection: true,
                    filtering: true,
                    search: false,
                    padding: "dense",
                    exportAllData: true,
                    exportButton: { csv: true, pdf: false },
                    exportCsv: wrappedExportCsv,
                }}
                editable={{
                    onRowUpdate: async (newDataset, oldDataset) => {
                        const diffDataset = rowDiff<Dataset>(newDataset, oldDataset);
                        if (oldDataset) {
                            datasetUpdateMutation.mutate(
                                {
                                    ...diffDataset,
                                    dataset_id: oldDataset.dataset_id,
                                },
                                {
                                    onSuccess: receivedDataset => {
                                        const removeUsed = files.filter(
                                            file => !receivedDataset.linked_files.includes(file)
                                        );
                                        queryClient.setQueryData(
                                            "unlinked",
                                            oldDataset && oldDataset.linked_files.length > 0
                                                ? [...oldDataset.linked_files, ...removeUsed].sort()
                                                : removeUsed
                                        );
                                        enqueueSnackbar(
                                            `Dataset ID ${newDataset.dataset_id} updated successfully`,
                                            { variant: "success" }
                                        );
                                    },
                                    onError: response => {
                                        console.error(
                                            `PATCH /api/datasets/${newDataset.dataset_id} failed with ${response.status}: ${response.statusText}`
                                        );
                                        enqueueSnackbar(
                                            `Failed to edit Dataset ID ${oldDataset?.dataset_id} - ${response.status} ${response.statusText}`,
                                            { variant: "error" }
                                        );
                                    },
                                }
                            );
                        }
                    },
                }}
                components={{
                    Toolbar: props => (
                        <div>
                            <MTableToolbar {...props} />
                            <div className={classes.chipBar}>
                                {metadatasetTypes &&
                                    Object.entries(
                                        metadatasetTypes
                                    ).map(([metatype, datasetTypes]) => (
                                        <Chip
                                            key={metatype}
                                            label={metatype}
                                            onClick={() =>
                                                updateTableFilter(
                                                    MTRef,
                                                    "dataset_type",
                                                    datasetTypes
                                                )
                                            }
                                            clickable
                                            className={classes.chip}
                                        />
                                    ))}
                                <IconButton
                                    onClick={() => updateTableFilter(MTRef, "dataset_type", "")}
                                    className={classes.chip}
                                >
                                    <Cancel />
                                </IconButton>
                            </div>
                        </div>
                    ),
                }}
                actions={[
                    {
                        tooltip: "Delete selected datasets",
                        icon: Delete,
                        hidden: !currentUser.is_admin,
                        position: "toolbarOnSelect",
                        onClick: (evt, data) => {
                            const sampleString = (data as Dataset[])
                                .map(
                                    dataset =>
                                        `${dataset.participant_codename}/${dataset.tissue_sample_type}/${dataset.dataset_type}`
                                )
                                .join(", ");
                            alert(
                                `Withdraw all datasets and records associated with: ${sampleString}`
                            );
                        },
                    },
                    {
                        tooltip: "Analyze selected datasets",
                        icon: PlayArrow,
                        position: "toolbarOnSelect",
                        onClick: (evt, data) => {
                            setSelectedDatasets(data as Dataset[]);
                            setRunner(true);
                        },
                    },
                    {
                        tooltip: "View dataset details",
                        icon: Visibility,
                        position: "row",
                        onClick: (event, data) => {
                            setInfoDataset(data as Dataset);
                            setShowInfo(true);
                        },
                    },
                ]}
                localization={{
                    header: {
                        actions: "", //remove action buttons' header
                    },
                }}
            />
        </div>
    );
}
