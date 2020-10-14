import React from 'react';
import { makeStyles } from '@material-ui/core';
import MaterialTable from 'material-table';
import DatasetAccordions from './DatasetAccordion';
import { Dataset, Sample } from './MockData';

const useStyles = makeStyles(theme => ({
    table: {
        marginBottom: theme.spacing(3),
    },
}));

const getDatasets = (samples: Sample[]) => {
    return samples.reduce((datasetList, sample) => {
        return datasetList.concat(sample.datasets);
    }, [] as Dataset[]);
}

interface ParticipantInfoProp {
    samples: Sample[],
}

export default function SamplesTable({ samples }: ParticipantInfoProp) {
    const classes = useStyles();

    return (
        <div className={classes.table}>
            <MaterialTable
                columns={[
                    { title: 'Sample ID', field: 'tissue_sample_id' },
                    { title: 'Extraction Date', field: 'extraction_date' },
                    { title: 'Sample Type', field: 'tissue_sample_type' },
                    { title: 'Tissue Processing', field: 'tissue_processing' },
                    { title: 'Notes', field: 'notes' },
                    { title: 'Creation Time', field: 'created' },
                    { title: 'Create By', field: 'create_by' },
                    { title: 'Update Time', field: 'updated' },
                    { title: 'Updated By', field: 'updated_by' },
                ]}
                data={samples}
                title="Samples"
                detailPanel={rowData => <DatasetAccordions datasets={getDatasets(samples)} />}
                options={{
                    paging: false,
                    selection: false,
                    search: false,
                }}
            />            
        </div>
    );
}