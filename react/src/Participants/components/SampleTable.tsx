import React from "react";
import MaterialTable, { MTableCell } from "@material-table/core";
import { makeStyles } from "@material-ui/core";
import { Dns } from "@material-ui/icons";
import { DateTimeText, InfoList } from "../../components";
import { createFieldObj, formatDateString } from "../../functions";
import { Dataset, Info, Sample } from "../../typings";

const useStyles = makeStyles(theme => ({
    datasetList: {
        marginLeft: theme.spacing(3),
        marginRight: theme.spacing(3),
    },
    cell: {
        padding: 0,
    },
}));

function getFields(dataset: Dataset) {
    return [
        createFieldObj(
            "Linked Files",
            dataset.linked_files.map(f => f.path)
        ),
        createFieldObj("Condition", dataset.condition),
        createFieldObj("Extraction Protocol", dataset.extraction_protocol),
        createFieldObj("Capture Kit", dataset.capture_kit),
        createFieldObj("Library Prep Method", dataset.library_prep_method),
        createFieldObj("Library Prep Date", formatDateString(dataset.library_prep_date)),
        createFieldObj("Read Length", dataset.read_length),
        createFieldObj("Read Type", dataset.read_type),
        createFieldObj("Sequencing ID", dataset.sequencing_id),
        createFieldObj("Sequencing Centre", dataset.sequencing_centre),
        createFieldObj("Creation Time", formatDateString(dataset.created)),
        createFieldObj("Created By", dataset.created_by),
        createFieldObj("Last Updated", formatDateString(dataset.updated)),
        createFieldObj("Updated By", dataset.updated_by),
        createFieldObj("Discriminator", dataset.discriminator),
    ];
}

export default function SampleTable(props: {
    samples: Sample[];
    enums?: Record<string, string[]>;
}) {
    const classes = useStyles();

    return (
        <MaterialTable
            columns={[
                {
                    title: "Extraction Date",
                    field: "extraction_date",
                    render: rowData => <DateTimeText datetime={rowData.extraction_date} />,
                },
                { title: "Sample Type", field: "tissue_sample_type" },
                { title: "Tissue Processing", field: "tissue_processing" },
                { title: "Notes", field: "notes" },
                {
                    title: "Creation Time",
                    field: "created",
                    render: rowData => <DateTimeText datetime={rowData.created} />,
                },
                { title: "Created By", field: "created_by" },
                {
                    title: "Update Time",
                    field: "updated",
                    render: rowData => <DateTimeText datetime={rowData.updated} />,
                },
                { title: "Updated By", field: "updated_by" },
            ]}
            data={props.samples}
            title="Tissue Samples"
            detailPanel={rowData => {
                const infoList: Info[] = rowData.datasets.map(dataset => {
                    return {
                        fields: getFields(dataset),
                        identifier: dataset.dataset_id,
                        linkPath: "datasets",
                        primaryListTitle: `Dataset ID ${dataset.dataset_id}`,
                    };
                });
                return (
                    <div className={classes.datasetList}>
                        <InfoList
                            infoList={infoList}
                            icon={<Dns />}
                            linkPath="/datasets"
                            enums={props.enums}
                        />
                    </div>
                );
            }}
            components={{
                Container: props => <div>{props.children}</div>,
                Cell: props => <MTableCell {...props} className={classes.cell} />,
            }}
            options={{
                paging: false,
                selection: false,
                search: false,
                headerStyle: {
                    padding: 0,
                },
            }}
        />
    );
}
