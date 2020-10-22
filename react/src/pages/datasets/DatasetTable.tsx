import React, { useEffect, useState } from 'react';
import { makeStyles, Chip, IconButton, TextField } from '@material-ui/core';
import { PlayArrow, Delete, Cancel } from '@material-ui/icons';
import MaterialTable, { MTableToolbar } from 'material-table';
import { toKeyValue, KeyValue, Dataset, formatDateString, emptyCellValue, Pipeline } from "../utils";
import AnalysisRunnerDialog from './AnalysisRunnerDialog';

const useStyles = makeStyles(theme => ({
    chip: {
        color: "primary",
        marginRight: '10px',
        colorPrimary: theme.palette.primary,
    },
    chipBar: {
        marginLeft: '24px',
        marginTop: '6px'
    }
}));

export default function DatasetTable() {
    const classes = useStyles();
    const [showRunner, setRunner] = useState(false);
    const [selectedDatasets, setSelectedDatasets] = useState<Dataset[]>([]);
    const [datasetTypeFilter, setDatasetTypeFilter] = useState<string[]>([]);

    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [tissueSampleTypes, setTissueSampleTypes] = useState<KeyValue>({});
    const [datasetTypes, setDatasetTypes] = useState<KeyValue>({});
    const [conditions, setConditions] = useState<KeyValue>({});

    useEffect(() => {
        fetch("/api/enums").then(async response => {
            if (response.ok) {
                const enums = await response.json();
                setTissueSampleTypes(toKeyValue(enums.TissueSampleType));
                setDatasetTypes(toKeyValue(enums.DatasetType));
                setConditions(toKeyValue(enums.DatasetCondition));
            } else {
                console.error(`GET /api/enums failed with ${response.status}: ${response.statusText}`);
            }
        });
        fetch("/api/datasets").then(async response => {
            if (response.ok) {
                const data = await response.json() as any[];
                setDatasets(data);
            } else {
                console.error(`GET /api/datasets failed with ${response.status}: ${response.statusText}`);
            }
        });
        fetch("/api/pipelines").then(async response => {
            if (response.ok) {
                setPipelines(await response.json());
            } else {
                console.error(`GET /api/pipelines failed with ${response.status}: ${response.statusText}`);
            }
        })
    }, []);

    return (
        <div>
            <AnalysisRunnerDialog
                datasets={selectedDatasets}
                pipelines={pipelines}
                open={showRunner}
                onClose={() => setRunner(false)}
            />
            <MaterialTable
                columns={[
                    { title: 'Participant', field: 'participant_codename', editable: 'never' },
                    { title: 'Family', field: 'family_codename', editable: 'never' },
                    { title: 'Tissue Sample', field: 'tissue_sample_type', editable: 'never', lookup: tissueSampleTypes },
                    { title: 'Dataset Type', field: 'dataset_type', defaultFilter: datasetTypeFilter, lookup: datasetTypes, emptyValue: emptyCellValue },
                    { title: 'Condition', field: 'condition', lookup: conditions, emptyValue: emptyCellValue },
                    { title: 'Notes', field: 'notes', emptyValue: emptyCellValue, editComponent: props => (
                        <TextField
                            multiline
                            value={props.value}
                            onChange={event => props.onChange(event.target.value)}
                            rows={4}
                            fullWidth
                        />
                    )},
                    // { title: 'Created', field: 'created', type: 'datetime' },
                    // { title: 'Created by', field: 'created_by' },
                    { title: 'Updated', field: 'updated', type: 'string', editable: 'never', render: rowData => formatDateString(rowData.updated) },
                    { title: 'Updated By', field: 'updated_by', editable: 'never' },
                ]}
                data={datasets}
                title="Datasets"
                options={{
                    pageSize: 10,
                    selection: true,
                    filtering: true,
                    search: false,
                    padding: "dense"
                }}
                editable={{
                    onRowUpdate: async (newDataset, oldDataset) => {
                        const response = await fetch(`/api/datasets/${newDataset.dataset_id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(newDataset)
                        });
                        if (response.ok) {
                            const updatedDataset = await response.json();
                            // Functional style: make a copy of the current state but replace
                            // the element that changed with the server's response. Mix in with
                            // the old because the PATCH endpoint does not respond with the
                            // participant codename, family codename, or tissue sample type.
                            setDatasets(datasets.map(dataset =>
                                dataset.dataset_id === newDataset.dataset_id
                                ? { ...dataset, ...updatedDataset }
                                : dataset
                            ));
                        } else {
                            console.error(`PATCH /api/datasets/${newDataset.dataset_id} failed with ${response.status}: ${response.statusText}`);
                        }
                    }
                }}
                cellEditable={{
                    onCellEditApproved: (newValue, oldValue, editedRow, columnDef) =>
                            new Promise((resolve, reject) => {
                                const dataUpdate = [...datasets];
                                const index = dataUpdate.findIndex((row, index, obj) => {
                                    return row.dataset_id === editedRow.dataset_id;
                                });
                                const newRow: Dataset = { ...dataUpdate[index] };

                                if (newValue === '')
                                    newValue = null;

                                switch (columnDef.field) {
                                    case 'dataset_type':
                                        newRow.dataset_type = newValue;
                                        break;
                                    case 'condition':
                                        newRow.condition = newValue;
                                        break;
                                    case 'notes':
                                        newRow.notes = newValue;
                                        break;
                                    default:
                                        break;
                                }
                                dataUpdate[index] = newRow;
                                setDatasets(dataUpdate);
                                resolve();
                            }),
                }}
                components={{
                    Toolbar: props => (
                        <div>
                            <MTableToolbar {...props} />
                            <div className={classes.chipBar}>
                                {[...new Set(datasets.map(e => e.dataset_type))].map(type => (
                                    <Chip label={type} onClick={() => setDatasetTypeFilter([type])} clickable className={classes.chip} />
                                ))}
                                <IconButton onClick={() => setDatasetTypeFilter([])} className={classes.chip}>
                                    <Cancel />
                                </IconButton>
                            </div>
                        </div>
                    ),
                }}
                actions={[
                    {
                        tooltip: 'Delete selected datasets',
                        icon: Delete,
                        onClick: (evt, data) => {
                            const sampleString = (data as Dataset[])
                                .map(dataset => `${dataset.participant_codename}/${dataset.tissue_sample_type}/${dataset.dataset_type}`)
                                .join(', ');
                            alert(`Withdraw all datasets and records associated with: ${sampleString}`)
                        }
                    },
                    {
                        tooltip: 'Analyze selected datasets',
                        icon: PlayArrow,
                        onClick: (evt, data) => {
                            setSelectedDatasets(data as Dataset[])
                            setRunner(true)
                        }
                    }
                ]}
            />
        </div>
    )
}
